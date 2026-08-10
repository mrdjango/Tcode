/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { expect } from 'chai';
import { TensorGridStartupGate } from './tensorgrid-startup-gate';

describe('Tcode startup gate', () => {
    it('buffers a login result arriving before the waiter', async () => {
        const gate = new TensorGridStartupGate();
        gate.notifyLoginResult({ success: true });
        expect(await gate.waitForLogin()).to.deep.equal({ success: true });
    });

    it('shares one pending result with concurrent waiters', async () => {
        const gate = new TensorGridStartupGate();
        const first = gate.waitForLogin();
        const second = gate.waitForLogin();
        expect(first).to.equal(second);
        gate.notifyLoginResult({ success: false, error: new Error('denied') });
        const result = await first;
        expect(result.success).to.equal(false);
        expect(result.error?.message).to.equal('denied');
    });
});
