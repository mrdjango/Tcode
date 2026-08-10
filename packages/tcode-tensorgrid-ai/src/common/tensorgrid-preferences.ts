/*****************************************************************************
 * Copyright (C) 2026 TensorGrid and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 *****************************************************************************/
import { nls, PreferenceSchema } from '@theia/core';
import { TENSORGRID_DEFAULT_BASE_URL } from './tensorgrid-provider';

export const TCODE_ENABLED_PREF = 'tcode.tensorgrid.enabled';
export const TCODE_BASE_URL_PREF = 'tcode.tensorgrid.baseUrl';
export const TCODE_MODELS_PREF = 'tcode.tensorgrid.models';

export const TensorGridPreferencesSchema: PreferenceSchema = {
    properties: {
        [TCODE_ENABLED_PREF]: {
            type: 'boolean',
            default: true,
            title: 'Tcode',
            description: nls.localize('tcode/tensorgrid/enabled', 'Enable the TensorGrid provider')
        },
        [TCODE_BASE_URL_PREF]: {
            type: 'string',
            default: TENSORGRID_DEFAULT_BASE_URL,
            title: 'Tcode',
            description: nls.localize('tcode/tensorgrid/baseUrl', 'OpenAI-compatible TensorGrid API base URL')
        },
        [TCODE_MODELS_PREF]: {
            type: 'array',
            default: [],
            title: 'Tcode',
            description: nls.localize('tcode/tensorgrid/models', 'TensorGrid model IDs available to Tcode'),
            items: { type: 'string' }
        }
    }
};
