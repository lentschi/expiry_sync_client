import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ProductEntriesPage } from './product-entries/product-entries';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component: ProductEntriesPage
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
