package app.masterreader.systemtts

import android.net.Uri
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.Locale

/**
 * Thin bridge over the device TTS engine.
 *
 * Synthesis always writes a WAV to a path chosen by JS, so the rest of the app
 * plays it through expo-audio: pause, seek, speed, lockscreen and background
 * playback then behave exactly like the neural engines. No text is ever played
 * live from here.
 */
class SystemTtsModule : Module() {
  private data class Waiter(val promise: Promise, val action: () -> Unit)

  private val lock = Any()
  private var tts: TextToSpeech? = null
  private var initialized = false
  private var initializing = false
  private var failure: String? = null
  private var generation = 0
  private val readyWaiters = mutableListOf<Waiter>()
  private val pending = mutableMapOf<String, Promise>()
  private var utteranceCounter = 0

  override fun definition() = ModuleDefinition {
    Name("SystemTts")

    Function("isAvailable") {
      val context = appContext.reactContext
      context != null &&
        context.packageManager
          .queryIntentServices(
            android.content.Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE),
            0,
          )
          .isNotEmpty()
    }

    AsyncFunction("warmup") { promise: Promise ->
      whenReady(promise) { promise.resolve(null) }
    }

    AsyncFunction("getVoices") { promise: Promise ->
      whenReady(promise) {
        val voices = tts?.voices.orEmpty().map { voice ->
          mapOf(
            "id" to voice.name,
            "name" to voice.name,
            "language" to voice.locale.toLanguageTag(),
            "networkRequired" to voice.isNetworkConnectionRequired,
          )
        }
        promise.resolve(voices)
      }
    }

    AsyncFunction("synthesize") { text: String, voiceId: String?, outputPath: String, promise: Promise ->
      whenReady(promise) {
        synthesizeToFile(text, voiceId, outputPath, promise)
      }
    }

    AsyncFunction("release") { promise: Promise ->
      synchronized(lock) {
        pending.values.forEach { it.reject("TTS_RELEASED", "The engine was released.", null) }
        pending.clear()
        readyWaiters.forEach { it.promise.reject("TTS_RELEASED", "The engine was released.", null) }
        readyWaiters.clear()
        generation += 1
        tts?.shutdown()
        tts = null
        initialized = false
        initializing = false
        failure = null
      }
      promise.resolve(null)
    }
  }

  private fun whenReady(promise: Promise, action: () -> Unit) {
    synchronized(lock) {
      val error = failure
      if (error != null) {
        promise.reject("TTS_INIT", error, null)
        return
      }
      if (initialized && tts != null) {
        action()
        return
      }
      readyWaiters.add(Waiter(promise, action))
    }
    ensureInit()
  }

  private fun ensureInit() {
    val startedAt = synchronized(lock) {
      if (initialized || initializing || failure != null) return
      initializing = true
      generation
    }

    val context = appContext.reactContext
    if (context == null) {
      failAll("No Android context.")
      return
    }

    val created = try {
      TextToSpeech(context) { status -> handleInit(status, startedAt) }
    } catch (error: Exception) {
      failAll("The text-to-speech engine could not start: ${error.message}")
      return
    }

    created.setOnUtteranceProgressListener(
      object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) = Unit

        override fun onDone(utteranceId: String?) {
          takePending(utteranceId)?.resolve(null)
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
          takePending(utteranceId)?.reject("TTS_SYNTH", "Synthesis failed.", null)
        }

        override fun onError(utteranceId: String?, errorCode: Int) {
          takePending(utteranceId)?.reject("TTS_SYNTH", "Synthesis failed (code $errorCode).", null)
        }

        override fun onStop(utteranceId: String?, interrupted: Boolean) {
          takePending(utteranceId)?.reject("TTS_STOPPED", "Synthesis was stopped.", null)
        }
      },
    )

    val stale = synchronized(lock) {
      if (startedAt != generation) {
        true
      } else {
        tts = created
        false
      }
    }
    if (stale) {
      created.shutdown()
      return
    }
    drainWaiters()
  }

  private fun handleInit(status: Int, startedAt: Int) {
    synchronized(lock) {
      if (startedAt != generation) return
      initializing = false
      if (status == TextToSpeech.SUCCESS) {
        initialized = true
      } else {
        failure = "The text-to-speech engine failed to start (status $status)."
      }
    }
    if (status == TextToSpeech.SUCCESS) drainWaiters() else failWaiters()
  }

  private fun synthesizeToFile(text: String, voiceId: String?, outputPath: String, promise: Promise) {
    val engine = tts
    if (engine == null) {
      promise.reject("TTS_INIT", "The text-to-speech engine is not ready.", null)
      return
    }

    val file = File(toPath(outputPath))
    file.parentFile?.mkdirs()
    if (file.exists() && !file.delete()) {
      promise.reject("TTS_WRITE", "Could not replace $outputPath", null)
      return
    }

    val voice = voiceId?.let { id -> engine.voices?.firstOrNull { it.name == id } }
    if (voice != null) {
      engine.voice = voice
    } else {
      engine.language = Locale.getDefault()
    }

    val utteranceId = "mr-${utteranceCounter++}"
    synchronized(lock) { pending[utteranceId] = promise }
    val started = engine.synthesizeToFile(text, Bundle(), file, utteranceId)
    if (started != TextToSpeech.SUCCESS) {
      takePending(utteranceId)?.reject("TTS_SYNTH", "Could not start synthesis.", null)
    }
  }

  private fun takePending(utteranceId: String?): Promise? {
    if (utteranceId == null) return null
    return synchronized(lock) { pending.remove(utteranceId) }
  }

  private fun drainWaiters() {
    val waiters: List<Waiter>
    synchronized(lock) {
      if (!initialized || tts == null) return
      waiters = readyWaiters.toList()
      readyWaiters.clear()
    }
    waiters.forEach { it.action() }
  }

  private fun failAll(message: String) {
    synchronized(lock) {
      failure = message
      initializing = false
    }
    failWaiters()
  }

  private fun failWaiters() {
    val waiters: List<Waiter>
    val message: String
    synchronized(lock) {
      message = failure ?: "The text-to-speech engine failed to start."
      waiters = readyWaiters.toList()
      readyWaiters.clear()
    }
    waiters.forEach { it.promise.reject("TTS_INIT", message, null) }
  }

  /** Accepts either a `file://` URI or a plain filesystem path. */
  private fun toPath(uriOrPath: String): String {
    if (!uriOrPath.startsWith("file:")) return uriOrPath
    return Uri.parse(uriOrPath).path ?: uriOrPath.removePrefix("file://").removePrefix("file:")
  }
}
