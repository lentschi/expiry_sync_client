import { NgModule } from '@angular/core';
import { IndexedMigration } from './indexed-migration';
import { InitialMigration } from './migrations/initial.migration';
import { ObfuscatePasswordsMigration } from './migrations/obfuscate-passwords.migration';

@NgModule({
    providers: [
        {
            provide: IndexedMigration,
            useClass: InitialMigration,
            multi: true
        },
        {
            provide: IndexedMigration,
            useClass: ObfuscatePasswordsMigration,
            multi: true
        }
    ]
})
export class IndexedMigrationsModule {}
