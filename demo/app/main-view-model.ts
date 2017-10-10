import { Observable } from 'tns-core-modules/data/observable';
import { Preferences } from 'nativescript-preferences';

export class HelloWorldModel extends Observable {
  public message: string;
  private preferences: Preferences;

  constructor() {
    super();

    this.preferences = new Preferences();
    this.message = this.preferences.message;
  }
}
