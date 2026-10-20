const { withGradleProperties } = require('expo/config-plugins');

/**
 * The default 2 GB heap is not enough to build every ABI with R8 minification
 * and resource shrinking: the release build died with
 * `java.lang.OutOfMemoryError: Java heap space` on the CI runner.
 */
const JVM_ARGS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m';

const withGradleHeap = (config) =>
  withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (entry) => entry.type === 'property' && entry.key === 'org.gradle.jvmargs',
    );
    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      config.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    }
    return config;
  });

module.exports = withGradleHeap;
