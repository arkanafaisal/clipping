package expo.modules.pythonrunner

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import kotlin.concurrent.thread

class PythonRunnerModule : Module() {
    companion object {
        @Volatile
        var isServerRunning: Boolean = false
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

            thread(isDaemon = true, name = "PythonLocalServerThread") {
                try {
                    isServerRunning = true
                    val py = Python.getInstance()
                    val serverModule = py.getModule("server")
                    serverModule.callAttr("start_server")
                } catch (e: Exception) {
                    isServerRunning = false
                    e.printStackTrace()
                }
            }

            return "STARTED"
        } catch (e: Exception) {
            e.printStackTrace()
            return "ERROR: " + e.message
        }
    }
}
