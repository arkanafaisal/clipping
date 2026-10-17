package expo.modules.pythonrunner

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import kotlin.concurrent.thread

class PythonRunnerModule : Module() {
    companion object {
        private const val TAG = "PythonRunner"
        @Volatile
        var isServerRunning: Boolean = false
        @Volatile
        var lastError: String? = null
    }

    override fun definition() = ModuleDefinition {
        Name("PythonRunner")

        OnCreate {
            // Auto start Python server on app launch
            startServerInternal()
        }

        Function("startServer") {
            return@Function startServerInternal()
        }

        Function("isServerRunning") {
            return@Function isServerRunning
        }

        Function("getLastError") {
            return@Function lastError
        }

        Function("getNativeInfo") {
            val context = appContext.reactContext
            val nativeLibDir = context?.applicationInfo?.nativeLibraryDir ?: ""
            val ffmpegFile = if (nativeLibDir.isNotEmpty()) java.io.File(nativeLibDir, "libffmpeg.so") else null
            return@Function mapOf(
                "nativeLibDir" to nativeLibDir,
                "ffmpegPath" to (ffmpegFile?.absolutePath ?: ""),
                "ffmpegExists" to (ffmpegFile?.exists() ?: false),
                "ffmpegCanExecute" to (ffmpegFile?.canExecute() ?: false)
            )
        }
    }

    private fun startServerInternal(): String {
        if (isServerRunning) {
            return "ALREADY_RUNNING"
        }
        val context = appContext.reactContext ?: return "NO_CONTEXT"

        try {
            if (!Python.isStarted()) {
                Python.start(AndroidPlatform(context))
            }

            thread(isDaemon = false, name = "PythonLocalServerThread") {
                try {
                    Log.i(TAG, "Getting Python instance...")
                    val py = Python.getInstance()
                    Log.i(TAG, "Loading server.py module...")
                    val serverModule = py.getModule("server")
                    isServerRunning = true
                    lastError = null
                    val nativeLibDir = context.applicationInfo.nativeLibraryDir
                    val ffmpegFile = java.io.File(nativeLibDir, "libffmpeg.so")
                    if (ffmpegFile.exists()) {
                        Log.i(TAG, "Bundled FFmpeg found: ${ffmpegFile.absolutePath} (canExecute=${ffmpegFile.canExecute()})")
                    } else {
                        Log.w(TAG, "Bundled libffmpeg.so not found in: $nativeLibDir")
                    }
                    Log.i(TAG, "Calling start_server(8080, nativeLibDir)...")
                    serverModule.callAttr("start_server", 8080, nativeLibDir)
                } catch (e: Exception) {
                    isServerRunning = false
                    lastError = e.message ?: e.toString()
                    Log.e(TAG, "Python server thread crashed: ${e.message}", e)
                }
            }

            return "STARTED"
        } catch (e: Exception) {
            lastError = e.message ?: e.toString()
            Log.e(TAG, "Failed to start Python runtime: ${e.message}", e)
            return "ERROR: " + e.message
        }
    }
}
