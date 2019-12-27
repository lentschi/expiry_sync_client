import { NgModule } from '@angular/core';
import { IndexedMigration } from './indexed-migration';
import { InitialMigration } from './migrations/initial';

@NgModule({
    providers: [
        {
            provide: IndexedMigration,
            useClass: InitialMigration,
            multi: true
        }
    ]
})
export class IndexedMigrationsModule {}
