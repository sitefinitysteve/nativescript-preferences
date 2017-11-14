# nativescript-preferences

This plugin allows native preference saving\loading on iOS and Android

![](/images/ios-sample.gif)
![](/images/android-sample.gif)

## Prerequisites / Requirements

* Create iOS Settings.bundle files in App_Resources/iOS [See Demo](https://github.com/sitefinitysteve/nativescript-preferences/tree/master/demo/app/App_Resources/iOS/Settings.bundle)
or [Apple Developer docs](https://developer.apple.com/library/content/documentation/Cocoa/Conceptual/UserDefaults/Preferences/Preferences.html)

## Installation

Describe your plugin installation steps. Ideally it would be something like:

```javascript
tns plugin add nativescript-preferences
```

## Usage 

	```javascript
    var prefs = new Preferences();

    //Get existing value
    prefs.getValue("name_preference");

    //Set value
    prefs.setValue("name_preference", "some new text");
    ```

## API

Describe your plugin methods and properties here. See [nativescript-feedback](https://github.com/EddyVerbruggen/nativescript-feedback) for example.
    
| Property | Default | Description |
| --- | --- | --- |
| openSettings(): any; |  | Opens the native settings panes |
| getValue(key: string): any; |  | Gets the value for the preference |
| setValue(key: string, value: any): void; |  | Sets the passed value to the preference |
    
## License

Apache License Version 2.0, January 2004
