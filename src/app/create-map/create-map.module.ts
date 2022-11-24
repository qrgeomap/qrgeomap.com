import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CreateMapPageRoutingModule } from './create-map-routing.module';

import { CreateMapPage } from './create-map.page';
import { ComponentsModule } from '../components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CreateMapPageRoutingModule,
    ComponentsModule
  ],
  declarations: [CreateMapPage]
})
export class CreateMapPageModule {}
