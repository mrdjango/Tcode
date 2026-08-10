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
import { createTensorGridModelDescription, normalizeTensorGridBaseUrl, TENSORGRID_DEFAULT_BASE_URL } from './tensorgrid-provider';

describe('Tcode TensorGrid provider', () => {
    it('normalizes the OpenAI-compatible endpoint', () => {
        expect(normalizeTensorGridBaseUrl('https://api.tensorgrid.space/v1/')).to.equal(TENSORGRID_DEFAULT_BASE_URL);
    });

    it('does not expose a model before authentication', () => {
        expect(createTensorGridModelDescription('tensorgrid/fast', 'https://api.tensorgrid.space/v1', 'sk-test')).to.deep.include({
            id: 'tensorgrid/fast',
            model: 'fast',
            apiKey: 'sk-test',
            url: TENSORGRID_DEFAULT_BASE_URL
        });
    });
});
