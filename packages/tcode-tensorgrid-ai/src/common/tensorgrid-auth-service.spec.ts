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
import { createCodeChallenge, createCodeVerifier, createTensorGridAuthUrls, redactTensorGridError, TENSORGRID_CALLBACK_URI } from './tensorgrid-auth-service';

describe('Tcode TensorGrid authentication contract', () => {
    it('builds trusted authorization endpoints', () => {
        expect(createTensorGridAuthUrls('https://api.tensorgrid.space/v1/')).to.deep.equal({
            authorize: 'https://tensorgrid.space/api/model-hub/tcode/authorize/',
            exchange: 'https://tensorgrid.space/api/model-hub/tcode/exchange/',
            loginPage: 'https://tensorgrid.space/tcode/authorize'
        });
    });

    it('redacts bearer credentials from server errors', () => {
        expect(redactTensorGridError('Authorization: Bearer secret-token')).to.equal('Authorization: Bearer [redacted]');
    });

    it('creates an RFC 7636 verifier and challenge', async () => {
        const verifier = createCodeVerifier(length => new Uint8Array(length).fill(1));
        expect(verifier).to.match(/^[A-Za-z0-9_-]{43}$/);
        expect(await createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).to.equal('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    });

    it('uses the registered Tcode callback URI', () => {
        expect(TENSORGRID_CALLBACK_URI).to.equal('tcode://tensorgrid/auth');
    });
});
