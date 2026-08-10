// *****************************************************************************
// Copyright (C) 2026 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// http://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { enableJSDOM } from '@theia/core/lib/browser/test/jsdom';

let disableJSDOM = enableJSDOM();

import { expect } from 'chai';
import { createRoot, Root } from '@theia/core/shared/react-dom/client';
import { ErrorChatResponseContent } from '@theia/ai-chat/lib/common';
import { ErrorPartRenderer } from './error-part-renderer';

disableJSDOM();

describe('ErrorPartRenderer', () => {
    let container: HTMLElement;
    let root: Root;

    before(() => disableJSDOM = enableJSDOM());
    after(() => disableJSDOM());

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        root.unmount();
        document.body.removeChild(container);
    });

    it('keeps the concise provider message visible and isolates expandable technical details', done => {
        const response = {
            kind: 'error',
            error: { message: '400 {"error":{"message":"Missing call_id","field":"input[4].call_id"}}' }
        } as ErrorChatResponseContent;

        root.render(new ErrorPartRenderer().render(response));

        setTimeout(() => {
            const headline = container.querySelector('.theia-ChatPart-Error-message');
            const details = container.querySelector('details');
            const technical = details?.querySelector('pre');
            expect(headline?.textContent).to.equal('Missing call_id');
            expect(headline?.getAttribute('dir')).to.equal('auto');
            expect(details?.hasAttribute('open')).to.equal(false);
            expect(technical?.classList.contains('theia-ChatTechnical')).to.equal(true);
            expect(technical?.getAttribute('dir')).to.equal('ltr');
            done();
        }, 0);
    });
});
