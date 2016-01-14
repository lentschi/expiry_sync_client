Setup v7-appcompat
===

s. [Support Library Setup](http://developer.android.com/tools/support-library/setup.html) - "using Eclipse":


Create a library project based on the support library code:

Make sure you have downloaded the Android Support Library using the SDK Manager.
Create a library project and ensure the required JAR files are included in the project's build path:

1. Select File > Import.
1. Select Existing Android Code Into Workspace and click Next.
1. Browse to the SDK installation directory and then to the Support Library folder. For example, if you are adding the appcompat project, browse to <sdk>/extras/android/support/v7/appcompat/.
1. Click Finish to import the project. For the v7 appcompat project, you should now see a new project titled android-support-v7-appcompat.
1. In the new library project, expand the libs/ folder, right-click each .jar file and select Build Path > Add to Build Path. For example, when creating the the v7 appcompat project, add both the android-support-v4.jar and android-support-v7-appcompat.jar files to the build path.
1. Right-click the project and select Build Path > Configure Build Path.
1. In the Order and Export tab, check the .jar files you just added to the build path, so they are available to projects that depend on this library project. For example, the appcompat project requires you to export both the android-support-v4.jar and android-support-v7-appcompat.jar files.
1. Uncheck Android Dependencies.
1. Click OK to complete the changes.

You now have a library project for your selected Support Library that you can use with one or more application projects.

Add the library to your application project:

1. In the Project Explorer, right-click your project and select Properties.
1. In the Library pane, click Add.
1. Select the library project and click OK. For example, the appcompat project should be listed as android-support-v7-appcompat.
1. In the properties window, click OK. 

Addendum:
Then there is a bug, that the "Android Dependencies" in the library procects get checked again. To solve this go to the library project's properties -> `Java Build Path` -> `Order and Export` -> uncheck `Android Dependencies` -> `OK`
Then remove and re-add the library from the app project.

Addendum II:
For android-22 the library's target must be set to android-22 too.