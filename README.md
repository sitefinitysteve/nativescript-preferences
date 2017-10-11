# nativescript-preferences

This plugin allows native preference saving\loading on iOS and Android

<img src="/images/ios-sample.png" alt="iOS Sample" style="max-width: 200px;"/>

## (Optional) Prerequisites / Requirements

Describe the prerequisites that the user need to have installed before using your plugin. See [nativescript-firebase plugin](https://github.com/eddyverbruggen/nativescript-plugin-firebase) for example.

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
| getValue(key: string): any; |  | Gets the value for the preference |
| setValue(key: string, value: any): void; |  | Sets the passed value to the preference |
    
## License

Apache License Version 2.0, January 2004
