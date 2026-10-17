const { withProjectBuildGradle, withSettingsGradle, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for Chaquopy 17.1.0
 */
function withChaquopy(config) {
  // 1. Inject Maven repository into settings.gradle
  config = withSettingsGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    const mavenRepo = 'https://chaquo.com/maven';

    if (!contents.includes(mavenRepo)) {
      if (contents.includes('pluginManagement {')) {
        contents = contents.replace(
          /pluginManagement\s*\{[\s\S]*?repositories\s*\{/,
          (match) => `${match}\n        maven { url "${mavenRepo}" }`
        );
      }
      if (contents.includes('dependencyResolutionManagement {')) {
        contents = contents.replace(
          /dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{/,
          (match) => `${match}\n        maven { url "${mavenRepo}" }`
        );
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });

  // 2. Inject repository & classpath into root build.gradle
  config = withProjectBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    const mavenRepo = 'https://chaquo.com/maven';

    // Inject to allprojects repositories if present
    if (contents.includes('allprojects {') && !contents.includes(mavenRepo)) {
      contents = contents.replace(
        /allprojects\s*\{\s*repositories\s*\{/,
        `allprojects {\n    repositories {\n        maven { url "${mavenRepo}" }`
      );
    }

    // Inject classpath to buildscript dependencies
    if (!contents.includes('com.chaquo.python:gradle')) {
      const classpathEntry = `        classpath "com.chaquo.python:gradle:17.1.0"\n`;
      if (contents.includes('buildscript {') && contents.includes('dependencies {')) {
        contents = contents.replace(
          /buildscript\s*\{[\s\S]*?dependencies\s*\{/,
          (match) => `${match}\n${classpathEntry}`
        );
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });

  // 3. Set android:extractNativeLibs="true" so bundled binaries in jniLibs (libffmpeg.so) are extracted to nativeLibraryDir with execution permissions
  config = withAndroidManifest(config, (mod) => {
    const mainApplication = mod.modResults.manifest.application?.[0];
    if (mainApplication) {
      mainApplication.$['android:extractNativeLibs'] = 'true';
    }
    return mod;
  });

  return config;
}

module.exports = withChaquopy;
