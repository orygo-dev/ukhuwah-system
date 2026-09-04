import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

val admobTestAppId = "ca-app-pub-3940256099942544~3347511713"
fun admobAppId(name: String): String? =
    providers.gradleProperty(name).orNull
        ?: providers.environmentVariable(name).orNull
val studentAdmobAppId = admobAppId("ADMOB_STUDENT_APP_ID")
val teacherAdmobAppId = admobAppId("ADMOB_TEACHER_APP_ID")
val admobAppIdPattern = Regex("^ca-app-pub-\\d{16}~\\d{10}$")
listOf(
    "ADMOB_STUDENT_APP_ID" to studentAdmobAppId,
    "ADMOB_TEACHER_APP_ID" to teacherAdmobAppId,
).forEach { (name, value) ->
    if (!value.isNullOrBlank() && !admobAppIdPattern.matches(value)) {
        throw GradleException("$name tidak memiliki format App ID AdMob yang valid.")
    }
}
val requestedTasks = gradle.startParameter.taskNames.joinToString(" ").lowercase()
if (requestedTasks.contains("release")) {
    if (!keystorePropertiesFile.exists()) {
        throw GradleException(
            "android/key.properties dan upload keystore wajib tersedia untuk build release. " +
                "Build release tidak boleh menggunakan debug signing."
        )
    }
    val explicitFlavor = requestedTasks.contains("student") || requestedTasks.contains("teacher")
    if ((!explicitFlavor || requestedTasks.contains("student")) && studentAdmobAppId.isNullOrBlank()) {
        throw GradleException("ADMOB_STUDENT_APP_ID wajib diisi untuk build student release.")
    }
    if ((!explicitFlavor || requestedTasks.contains("teacher")) && teacherAdmobAppId.isNullOrBlank()) {
        throw GradleException("ADMOB_TEACHER_APP_ID wajib diisi untuk build teacher release.")
    }
}

android {
    namespace = "com.genpro.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    flavorDimensions += "audience"

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.genpro.app"
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appName"] = "GenPro"
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    productFlavors {
        create("student") {
            dimension = "audience"
            applicationId = "com.genpro.app"
            manifestPlaceholders["appName"] = "GenPro"
            manifestPlaceholders["admobAppId"] = studentAdmobAppId ?: admobTestAppId
        }
        create("teacher") {
            dimension = "audience"
            applicationId = "com.genpro.teacher"
            manifestPlaceholders["appName"] = "GenPro Guru"
            manifestPlaceholders["admobAppId"] = teacherAdmobAppId ?: admobTestAppId
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("com.google.android.play:app-update:2.1.0")
    implementation("com.google.android.play:app-update-ktx:2.1.0")
}
