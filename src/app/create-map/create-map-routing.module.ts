import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CreateMapPage } from './create-map.page';

const routes: Routes = [
  {
    path: '',
    component: CreateMapPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CreateMapPageRoutingModule {}
