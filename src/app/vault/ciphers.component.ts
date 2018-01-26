import * as template from './ciphers.component.html';

import {
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';

import { CipherView } from 'jslib/models/view/cipherView';

@Component({
    selector: 'app-vault-ciphers',
    template: template,
})
export class CiphersComponent {
    @Input() ciphers: CipherView[];
    @Output() onCipherClicked = new EventEmitter<CipherView>();
    @Output() onAddCipher = new EventEmitter();

    cipherClicked(cipher: CipherView) {
        this.onCipherClicked.emit(cipher);
    }

    addCipher() {
        this.onAddCipher.emit();
    }
}
