import { Component, ViewChild, ViewContainerRef, ComponentFactoryResolver, ComponentRef } from '@angular/core';
import { NavParams, ViewController } from 'ionic-angular';
import { Setting } from '../../../../app/models';

@Component({
  templateUrl: 'setting-edit.html'
})
export class SettingEditModal {
  setting:Setting;
  @ViewChild('settingEditContainer', {read: ViewContainerRef}) settingEditContainer: ViewContainerRef;
  private cmpRef: ComponentRef<Component>;
  private componentUpated:boolean = false;

  constructor(private params:NavParams, private viewCtrl:ViewController, private componentFactoryResolver: ComponentFactoryResolver) {
    // Retrieve the setting we want to edit from the db:
    Setting.findBy('key', this.params.get('settingKey')).then((setting:Setting) => {
      this.setting = setting;
    });
  }

  ngAfterViewChecked() {
    if (this.setting && !this.componentUpated) {
      this.componentUpated = true;
      setTimeout(() => {
          this.updateComponent();
      },1);
    }
  }

  dismiss(setting?:Setting) {
    this.viewCtrl.dismiss(setting);
  }


  updateComponent() {
    let factory = this.componentFactoryResolver.resolveComponentFactory(this.setting.editComponent);
    this.cmpRef = this.settingEditContainer.createComponent(factory)
    let instance:any = this.cmpRef.instance;
    instance.setting = this.setting;
  }

  ngOnDestroy() {
    if(this.cmpRef) {
      this.cmpRef.destroy();
    }
  }
}
