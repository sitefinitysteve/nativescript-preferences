[![Twitter Follow][twitter-image]][twitter-url]

[twitter-image]:https://img.shields.io/twitter/follow/stevemcniven.svg?style=social&label=Follow%20me
[twitter-url]:https://twitter.com/stevemcniven


# nativescript-preferences

This plugin allows native preference saving\loading on iOS and Android

<img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/src/images/ios-sample.gif" width="300" />
<img src="https://raw.githubusercontent.com/sitefinitysteve/nativescript-preferences/master/src/images/android-sample.gif"  width="300" />

## iOS Prerequisites

* Create iOS Settings.bundle files in App_Resources/iOS [See Demo](https://github.com/sitefinitysteve/nativescript-preferences/tree/master/demo/app/App_Resources/iOS/Settings.bundle)
or [Apple Developer docs](https://developer.apple.com/library/content/documentation/Cocoa/Conceptual/UserDefaults/Preferences/Preferences.html)

## Android Prerequisites
* In App_Resources/Android/xml create [preferences.xml](https://github.com/sitefinitysteve/nativescript-preferences/blob/master/demo/app/App_Resources/Android/xml/preferences.xml)
* Android [PreferenceScreen docs](https://developer.android.com/reference/android/preference/PreferenceScreen.html)

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
    
| Property | Default | Description |
| --- | --- | --- |
| openSettings(): any; |  | Opens the native settings panes |
| getValue(key: string): any; |  | Gets the value for the preference |
| setValue(key: string, value: any): void; |  | Sets the passed value to the preference |
    
## License

Apache License Version 2.0, January 2004
