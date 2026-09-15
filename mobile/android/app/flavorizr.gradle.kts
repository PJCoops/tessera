import com.android.build.gradle.AppExtension

val android = project.extensions.getByType(AppExtension::class.java)

android.apply {
    flavorDimensions("flavor-type")

    productFlavors {
        create("dev") {
            dimension = "flavor-type"
            applicationId = "com.tesserapuzzle.app.dev"
            resValue(type = "string", name = "app_name", value = "Tessera Dev")
            // AdMob (spec §8.1): dev always uses Google's public test app
            // id, never real inventory.
            manifestPlaceholders["admobAppId"] = "ca-app-pub-3940256099942544~3347511713"
        }
        create("prod") {
            dimension = "flavor-type"
            applicationId = "com.tesserapuzzle.app"
            resValue(type = "string", name = "app_name", value = "Tessera")
            // Real app id, "Tessera Puzzle" in the AdMob console.
            manifestPlaceholders["admobAppId"] = "ca-app-pub-9183489019845927~2690319420"
        }
    }

    buildFeatures.resValues = true
}