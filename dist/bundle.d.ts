import { CallbacksT } from '../../../../../../src/schemas';
import { ClientAPIT } from '../../../../../../src/schemas';
import { convertZod } from './utils';
import { ErrorT } from '../../../../../../src/schemas';
import { ModuleS } from '../../../../../../src/schemas';
import { ModuleT } from '../../../../../../src/schemas';
import { RequestAPIT } from '../../../../../../src/schemas';
import { RequestCallT } from '../../../../../../src/schemas';
import { ServerAPIT } from '../../../../../../src/schemas/server';
import { SignedTransactionT } from '../../../../../../src/schemas';
import { z } from 'zod';

export declare function Client<T>({ host, type, server_modules, server_private_key, }: {
    host?: string;
    type: "websocket" | "events";
    server_modules?: ModuleT[];
    server_private_key?: string;
}): Promise<ClientAPIT | ErrorT>;

export { convertZod }

declare function Request_2<T>({ tx, onData: _onData, onDone: _onDone, onError: _onError, request_id, method_id, module_id, }: {
    request_id: string;
    tx?: SignedTransactionT;
} & RequestCallT & CallbacksT): Promise<RequestAPIT>;
export { Request_2 as Request }

export declare function Server({ modules, private_key, protocols, globals, type, no_auth, host, port }: {
    modules: z.infer<typeof ModuleS>[];
    private_key?: string;
    protocols?: {
        id: string;
        logic: any;
    }[];
    globals?: any;
    type?: "events" | "websocket";
    no_auth?: boolean;
    host?: string;
    port?: number;
}): Promise<ServerAPIT>;

export { }
