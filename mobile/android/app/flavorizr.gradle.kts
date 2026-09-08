import com.android.build.gradle.AppExtension

val android = project.extensions.getByType(AppExtension::class.java)

android.apply {
    flavorDimensions("flavor-type")

    productFlavors {
        create("dev") {
            dimension = "flavor-type"
            applicationId = "com.tesserapuzzle.app.dev"
            resValue(type = "string", name = "app_name", value = "Tessera Dev")
        }
        create("prod") {
            dimension = "flavor-type"
            applicationId = "com.tesserapuzzle.app"
            resValue(type = "string", name = "app_name", value = "Tessera")
        }
    }

    buildFeatures.resValues = true
}