package expo.modules.pythonrunner

import android.util.Log
import android.os.Build
import android.os.Environment
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import kotlin.concurrent.thread

class PythonRunnerModule : Module() {
    companion object {
        private const val TAG = "PythonRunner"
        @Volatile
        var isPythonInitialized: Boolean = false
        @Volatile
        var lastError: String? = null
    }

    override fun definition() = ModuleDefinition {
        Name("PythonRunner")

        OnCreate {
            val context = appContext.reactContext
            if (context != null && !Python.isStarted()) {
                try {
                    Python.start(AndroidPlatform(context))
                    isPythonInitialized = true
                    Log.i(TAG, "Python engine successfully started via Chaquopy.")
                } catch (e: Exception) {
                    lastError = e.message ?: e.toString()
                    Log.e(TAG, "Failed to initialize Python engine: ${e.message}", e)
                }
            }
        }

        Function("isInitialized") {
            return@Function isPythonInitialized
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

        Function("checkStoragePermission") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                return@Function Environment.isExternalStorageManager()
            }
            return@Function true
        }

        Function("requestStoragePermission") {
            val context = appContext.reactContext ?: return@Function false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (!Environment.isExternalStorageManager()) {
                    try {
                        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                            data = Uri.parse("package:" + context.packageName)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        context.startActivity(intent)
                        return@Function true
                    } catch (e: Exception) {
                        try {
                            val fallbackIntent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            context.startActivity(fallbackIntent)
                            return@Function true
                        } catch (err: Exception) {
                            Log.e(TAG, "Failed to launch storage settings: ${err.message}", err)
                            return@Function false
                        }
                    }
                }
            }
            return@Function true
        }

        Function("setupPaths") { customRootPath: String ->
            val context = appContext.reactContext ?: return@Function "NO_CONTEXT"
            ensurePythonStarted(context)
            try {
                val py = Python.getInstance()
                val runnerModule = py.getModule("runner")
                val result = runnerModule.callAttr("setup_paths", customRootPath).toString()
                return@Function result
            } catch (e: Exception) {
                lastError = e.message ?: e.toString()
                Log.e(TAG, "setupPaths failed: ${e.message}", e)
                return@Function "ERROR: ${e.message}"
            }
        }

        AsyncFunction("executeScript") { moduleName: String, funcName: String, argsJson: String, promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.reject("NO_CONTEXT", "Android ReactContext is null", null)
                return@AsyncFunction
            }

            thread(isDaemon = false, name = "PythonScriptThread") {
                try {
                    ensurePythonStarted(context)
                    val py = Python.getInstance()
                    val runnerModule = py.getModule("runner")
                    val resultJson = runnerModule.callAttr("execute_function", moduleName, funcName, argsJson).toString()
                    promise.resolve(resultJson)
                } catch (e: Exception) {
                    lastError = e.message ?: e.toString()
                    Log.e(TAG, "executeScript failed: ${e.message}", e)
                    promise.reject("EXECUTION_ERROR", e.message ?: e.toString(), e)
                }
            }
        }
    }

    private fun ensurePythonStarted(context: android.content.Context) {
        if (!Python.isStarted()) {
            Python.start(AndroidPlatform(context))
            isPythonInitialized = true
        }
    }
}
