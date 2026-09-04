package com.ukhuwahmobile.app

import android.app.Activity
import android.content.Intent
import android.os.Build

import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        private const val UPDATE_CHANNEL = "genpro/in_app_update"
        private const val UPDATE_REQUEST_CODE = 7301
    }

    private lateinit var appUpdateManager: AppUpdateManager
    private var updateChannel: MethodChannel? = null
    private var latestUpdateInfo: AppUpdateInfo? = null
    private var updateFlowRunning = false
    private var installListenerRegistered = false

    private val installStateListener = InstallStateUpdatedListener { state ->
        updateChannel?.invokeMethod(
            "installState",
            mapOf(
                "status" to state.installStatus(),
                "bytesDownloaded" to state.bytesDownloaded(),
                "totalBytes" to state.totalBytesToDownload(),
            ),
        )
        if (state.installStatus() == InstallStatus.DOWNLOADED ||
            state.installStatus() == InstallStatus.FAILED ||
            state.installStatus() == InstallStatus.CANCELED
        ) {
            updateFlowRunning = false
            unregisterInstallListener()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    @Deprecated("Deprecated in Android Activity; required by the Play update request-code API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == UPDATE_REQUEST_CODE) {
            handleUpdateFlowResult(resultCode)
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        appUpdateManager = AppUpdateManagerFactory.create(this)
        updateChannel = MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            UPDATE_CHANNEL,
        ).also { channel ->
            channel.setMethodCallHandler { call, result ->
                when (call.method) {
                    "checkForUpdate" -> checkForUpdate(result)
                    "startUpdate" -> {
                        val immediate = call.argument<Boolean>("immediate") == true
                        startUpdate(immediate, result)
                    }
                    "completeUpdate" -> completeUpdate(result)
                    else -> result.notImplemented()
                }
            }
        }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "genpro/pjj_background")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "start" -> {
                        try {
                            val intent = Intent(this, PjjForegroundService::class.java)
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                startForegroundService(intent)
                            } else {
                                startService(intent)
                            }
                            result.success(null)
                        } catch (error: Exception) {
                            result.error("pjj_background", error.message, null)
                        }
                    }
                    "stop" -> {
                        try {
                            stopService(Intent(this, PjjForegroundService::class.java))
                            result.success(null)
                        } catch (error: Exception) {
                            result.error("pjj_background", error.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        unregisterInstallListener()
        updateChannel?.setMethodCallHandler(null)
        updateChannel = null
        latestUpdateInfo = null
        super.cleanUpFlutterEngine(flutterEngine)
    }

    private fun unregisterInstallListener() {
        if (!installListenerRegistered || !::appUpdateManager.isInitialized) return
        appUpdateManager.unregisterListener(installStateListener)
        installListenerRegistered = false
    }

    override fun onResume() {
        super.onResume()
        if (!::appUpdateManager.isInitialized) return
        appUpdateManager.appUpdateInfo.addOnSuccessListener { info ->
            latestUpdateInfo = info
            if (info.updateAvailability() ==
                UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS &&
                info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) &&
                !updateFlowRunning
            ) {
                launchUpdate(info, AppUpdateType.IMMEDIATE)
            }
            if (info.installStatus() == InstallStatus.DOWNLOADED) {
                updateChannel?.invokeMethod(
                    "installState",
                    mapOf(
                        "status" to InstallStatus.DOWNLOADED,
                        "bytesDownloaded" to 0L,
                        "totalBytes" to 0L,
                    ),
                )
            }
        }
    }

    private fun checkForUpdate(result: MethodChannel.Result) {
        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                latestUpdateInfo = info
                result.success(updateInfoMap(info))
            }
            .addOnFailureListener { error ->
                result.error("update_check_failed", error.message, null)
            }
    }

    private fun startUpdate(immediate: Boolean, result: MethodChannel.Result) {
        if (updateFlowRunning) {
            result.success(true)
            return
        }
        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                latestUpdateInfo = info
                val requestedType = if (immediate) AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
                val resolvedType = when {
                    info.isUpdateTypeAllowed(requestedType) -> requestedType
                    info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> AppUpdateType.FLEXIBLE
                    info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> AppUpdateType.IMMEDIATE
                    else -> null
                }
                if (resolvedType == null ||
                    (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE &&
                        info.updateAvailability() !=
                        UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
                ) {
                    result.success(false)
                    return@addOnSuccessListener
                }
                if (resolvedType == AppUpdateType.FLEXIBLE && !installListenerRegistered) {
                    appUpdateManager.registerListener(installStateListener)
                    installListenerRegistered = true
                }
                val started = launchUpdate(info, resolvedType)
                result.success(started)
            }
            .addOnFailureListener { error ->
                result.error("update_start_failed", error.message, null)
            }
    }

    private fun launchUpdate(info: AppUpdateInfo, updateType: Int): Boolean {
        return try {
            val started = appUpdateManager.startUpdateFlowForResult(
                info,
                this,
                AppUpdateOptions.newBuilder(updateType).build(),
                UPDATE_REQUEST_CODE,
            )
            updateFlowRunning = started
            started
        } catch (error: Exception) {
            updateFlowRunning = false
            updateChannel?.invokeMethod(
                "flowError",
                mapOf("message" to (error.message ?: "Pembaruan tidak dapat dimulai.")),
            )
            false
        }
    }

    private fun completeUpdate(result: MethodChannel.Result) {
        appUpdateManager.completeUpdate()
            .addOnSuccessListener { result.success(true) }
            .addOnFailureListener { error ->
                result.error("update_complete_failed", error.message, null)
            }
    }

    private fun handleUpdateFlowResult(resultCode: Int) {
        updateFlowRunning = false
        if (resultCode == Activity.RESULT_OK || resultCode == Activity.RESULT_CANCELED) {
            updateChannel?.invokeMethod(
                "flowResult",
                mapOf("resultCode" to resultCode),
            )
        } else {
            updateChannel?.invokeMethod(
                "flowError",
                mapOf("message" to "Google Play tidak dapat menyelesaikan pembaruan."),
            )
        }
    }

    private fun updateInfoMap(info: AppUpdateInfo): Map<String, Any?> = mapOf(
        "available" to (
            info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
                info.updateAvailability() ==
                UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
            ),
        "developerTriggered" to (
            info.updateAvailability() ==
                UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
            ),
        "availableVersionCode" to info.availableVersionCode(),
        "priority" to info.updatePriority(),
        "stalenessDays" to info.clientVersionStalenessDays(),
        "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
        "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
        "installStatus" to info.installStatus(),
        "packageName" to packageName,
    )
}
