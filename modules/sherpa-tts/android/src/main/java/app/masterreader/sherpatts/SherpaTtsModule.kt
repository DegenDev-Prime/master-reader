package app.masterreader.sherpatts

import android.net.Uri
import com.k2fsa.sherpa.onnx.GeneratedAudio
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream

/**
 * Thin bridge over sherpa-onnx offline TTS (Piper VITS + Kokoro).
 *
 * Model files are never bundled: voice packs download on demand into app
 * storage and [initVoice] points the engine at an extracted pack directory,
 * auto-discovering model.onnx / tokens.txt / voices.bin / espeak-ng-data.
 * All voices speak through file output; playback, rate and headset behavior
 * stay in JS.
 */
class SherpaTtsModule : Module() {
  private val lock = Any()
  private var tts: OfflineTts? = null

  override fun definition() = ModuleDefinition {
    Name("SherpaTts")

    AsyncFunction("isAvailable") { true }

    AsyncFunction("initVoice") { engine: String, dir: String, numThreads: Int, promise: Promise ->
      try {
        val created = createTts(engine, File(toPath(dir)), numThreads)
        synchronized(lock) {
          tts?.release()
          tts = created
        }
        promise.resolve(
          mapOf(
            "sampleRate" to created.sampleRate(),
            "numSpeakers" to created.numSpeakers(),
          ),
        )
      } catch (e: Exception) {
        promise.reject("INIT_FAILED", e.message ?: "Failed to initialize voice", e)
      }
    }

    AsyncFunction("synthesize") { text: String, sid: Int, outputPath: String, promise: Promise ->
      try {
        val audio: GeneratedAudio = synchronized(lock) {
          val current = tts ?: throw IllegalStateException("Voice not initialized")
          current.generate(text, sid, 1.0f)
        }
        val path = toPath(outputPath)
        if (!audio.save(path)) {
          throw java.io.IOException("Failed to write $path")
        }
        promise.resolve(
          mapOf(
            "sampleRate" to audio.sampleRate,
            "frames" to audio.samples.size,
          ),
        )
      } catch (e: Exception) {
        promise.reject("SYNTH_FAILED", e.message ?: "Synthesis failed", e)
      }
    }

    AsyncFunction("extractTarBz2") { archivePath: String, destDir: String, promise: Promise ->
      try {
        promise.resolve(extractTarBz2(File(toPath(archivePath)), File(toPath(destDir))))
      } catch (e: Exception) {
        promise.reject("EXTRACT_FAILED", e.message ?: "Extraction failed", e)
      }
    }

    AsyncFunction("release") {
      synchronized(lock) {
        tts?.release()
        tts = null
      }
    }
  }

  private fun createTts(engine: String, dir: File, numThreads: Int): OfflineTts {
    val resolved = resolveVoiceDir(dir)
    val model = resolved.listFiles { file -> file.extension == "onnx" }?.firstOrNull()
      ?: throw IllegalArgumentException("No .onnx model in $resolved")
    val tokens = File(resolved, "tokens.txt").takeIf { it.exists() }
      ?: throw IllegalArgumentException("Missing tokens.txt in $resolved")
    val dataDir = File(resolved, "espeak-ng-data").takeIf { it.exists() }

    val modelConfig = if (engine == "kokoro") {
      val voices = File(resolved, "voices.bin").takeIf { it.exists() }
        ?: throw IllegalArgumentException("Missing voices.bin in $resolved")
      OfflineTtsModelConfig(
        kokoro = OfflineTtsKokoroModelConfig(
          model = model.absolutePath,
          voices = voices.absolutePath,
          tokens = tokens.absolutePath,
          dataDir = dataDir?.absolutePath ?: "",
        ),
        numThreads = maxOf(1, numThreads),
        debug = false,
      )
    } else {
      OfflineTtsModelConfig(
        vits = OfflineTtsVitsModelConfig(
          model = model.absolutePath,
          tokens = tokens.absolutePath,
          dataDir = dataDir?.absolutePath ?: "",
        ),
        numThreads = maxOf(1, numThreads),
        debug = false,
      )
    }
    return OfflineTts(config = OfflineTtsConfig(model = modelConfig))
  }

  /** Accepts either a `file://` URI or a plain filesystem path. */
  private fun toPath(uriOrPath: String): String {
    if (!uriOrPath.startsWith("file:")) return uriOrPath
    return Uri.parse(uriOrPath).path ?: uriOrPath.removePrefix("file://").removePrefix("file:")
  }

  /** Tarballs nest files one level deep; resolve to the directory holding the model. */
  private fun resolveVoiceDir(dir: File): File {
    if (hasOnnx(dir)) return dir
    val child = dir.listFiles { file -> file.isDirectory && hasOnnx(file) }?.firstOrNull()
    return child ?: dir
  }

  /** Voice model filenames vary (e.g. `en_US-amy-low.onnx`), so match by extension. */
  private fun hasOnnx(dir: File): Boolean =
    dir.listFiles { file -> file.isFile && file.name.lowercase().endsWith(".onnx") }?.isNotEmpty() == true

  private fun extractTarBz2(archive: File, destDir: File): List<String> {
    val names = mutableListOf<String>()
    val bufferSize = 1 shl 16
    FileInputStream(archive).buffered(bufferSize).use { fileInput ->
      BZip2CompressorInputStream(fileInput).buffered(bufferSize).use { bzip2 ->
        TarArchiveInputStream(bzip2).use { tar ->
          var entry = tar.nextEntry
          while (entry != null) {
            val out = File(destDir, entry.name)
            if (entry.isDirectory) {
              out.mkdirs()
            } else {
              out.parentFile?.mkdirs()
              out.outputStream().buffered(bufferSize).use { output ->
                tar.copyTo(output, bufferSize)
              }
              names.add(entry.name)
            }
            entry = tar.nextEntry
          }
        }
      }
    }
    return names
  }
}
