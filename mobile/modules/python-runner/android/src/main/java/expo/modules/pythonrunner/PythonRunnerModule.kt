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
                    Log.i(TAG, "Calling start_server()...")
                    serverModule.callAttr("start_server")
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
