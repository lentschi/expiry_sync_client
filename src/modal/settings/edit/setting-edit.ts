import { Component, ViewChild, ViewContainerRef, ComponentFactoryResolver, ComponentRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Setting } from 'src/app/models';
import { SettingEditElement } from './types/setting-edit-element';

@Component({
  templateUrl: 'setting-edit.html'
})
export class SettingEditModal implements AfterViewChecked, OnDestroy {
  setting: Setting;
  settingKey: string;
  @ViewChild('settingEditContainer', { read: ViewContainerRef }) settingEditContainer: ViewContainerRef;
  private cmpRef: ComponentRef<SettingEditElement>;
  private componentUpated = false;

  constructor(
    private modalCtrl: ModalController,
    private componentFactoryResolver: ComponentFactoryResolver
  ) {
    // Retrieve the setting we want to edit from the db:
    Setting.findBy('key', this.settingKey).then((setting: Setting) => {
      this.setting = setting;
    });
  }

  ngAfterViewChecked() {
    if (this.setting && !this.componentUpated) {
      this.componentUpated = true;
      setTimeout(() => {
        this.updateComponent();
      }, 1);
    }
  }

  dismiss(setting?: Setting) {
    this.modalCtrl.dismiss(setting);
  }


  updateComponent() {
    const factory = this.componentFactoryResolver.resolveComponentFactory(this.setting.editComponent);
    this.cmpRef = this.settingEditContainer.createComponent(factory);
    const instance: any = this.cmpRef.instance;
    instance.setting = this.setting;
  }

  ngOnDestroy() {
    if (this.cmpRef) {
      this.cmpRef.destroy();
    }
  }
}
