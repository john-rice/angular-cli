/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { NgModule } from '@angular/core';
import { LibComponent } from './lib.component';
import { LibService } from './lib.service';

@NgModule({
  imports: [
  ],
  declarations: [LibComponent],
  providers: [LibService]
})
export class LibModule { }
