import { web3 } from '@coral-xyz/anchor'
import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

import * as EndpointProgram from './endpoint'
import {
    COUNT_SEED,
    LZ_COMPOSE_TYPES_SEED,
    LZ_RECEIVE_TYPES_SEED,
    OAppBasePDADeriver,
} from './pda-deriver'
import { AddressType } from './types'

import { SimpleMessageLibProgram, UlnProgram } from '.'

/**
 * Derives the program address for the OApp ID PDA.
 *
 * @param program - The program public key.
 * @param seed - The seed to use for the PDA derivation.
 * @param id - Optional. The ID to use for the PDA derivation.
 * @returns A tuple containing the derived PDA and the bump number.
 */
// TODO - replace default seed to a convention ID Seed
export function oappIDPDA(program: PublicKey, seed = COUNT_SEED, id?: number): [PublicKey, number] {
    if (id != undefined) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(seed, 'utf8'), new BN(id).toArrayLike(Buffer, 'be', 1)],
            program
        )
    } else {
        return PublicKey.findProgramAddressSync([Buffer.from(seed, 'utf8')], program)
    }
}

/**
 * Derives the program address for the LZ Receive Types Accounts PDA.
 *
 * @param program - The program public key.
 * @param oappId - Optional. The OApp ID to use for the PDA derivation.
 * @returns A tuple containing the derived PDA and the bump number.
 */
export function deriveLzReceiveTypesAccountsPDA(
    program: PublicKey,
    oappId?: PublicKey
): [PublicKey, number] {
    if (oappId != undefined) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(LZ_RECEIVE_TYPES_SEED, 'utf8'), oappId.toBytes()],
            program
        )
    }
    return PublicKey.findProgramAddressSync([Buffer.from(LZ_RECEIVE_TYPES_SEED, 'utf8')], program)
}

/**
 * Derives the program address for the LZ Compose Types Accounts PDA.
 *
 * @param program - The program public key.
 * @param oappId - Optional. The OApp ID to use for the PDA derivation.
 * @returns A tuple containing the derived PDA and the bump number.
 */
export function deriveLzComposeTypesAccountsPDA(
    program: PublicKey,
    oappId?: PublicKey
): [PublicKey, number] {
    if (oappId != undefined) {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(LZ_COMPOSE_TYPES_SEED, 'utf8'), oappId.toBytes()],
            program
        )
    }
    return PublicKey.findProgramAddressSync([Buffer.from(LZ_COMPOSE_TYPES_SEED, 'utf8')], program)
}

/**
 * Abstract base class for OApps.
 */
export abstract class BaseOApp {
    oappBaseDeriver: OAppBasePDADeriver

    /**
     * Constructor for the BaseOApp class.
     *
     * @param program - The program public key.
     */
    constructor(public program: PublicKey) {
        this.oappBaseDeriver = new OAppBasePDADeriver(program)
    }

    /**
     * Abstract method to get the endpoint.
     *
     * @param connection - The Solana connection object.
     * @returns A promise that resolves to the endpoint.
     */
    abstract getEndpoint(connection: Connection): Promise<EndpointProgram.Endpoint>

    /**
     * Abstract method to get the send library program.
     *
     * @param connection - The Solana connection object.
     * @param payer - The payer public key.
     * @param dstEid - The destination endpoint ID.
     * @param endpoint - Optional. The endpoint object.
     * @returns A promise that resolves to the send library program.
     */
    abstract getSendLibraryProgram(
        connection: Connection,
        payer: PublicKey,
        dstEid: number,
        endpoint?: EndpointProgram.Endpoint
    ): Promise<SimpleMessageLibProgram.SimpleMessageLib | UlnProgram.Uln>

    /**
     * Queries the account info for the ID PDA.
     *
     * @param connection - The Solana connection object.
     * @param commitmentOrConfig - Optional. The commitment level or account info config.
     * @returns A promise that resolves to the account info or null if not found.
     */
    async queryIDPDAInfo(
        connection: Connection,
        commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
    ): Promise<AccountInfo<Buffer> | null> {
        return this.queryPDAInfo(connection, this.idPDA()[0], commitmentOrConfig)
    }

    /**
     * Queries the account info for the given PDA.
     *
     * @param connection - The Solana connection object.
     * @param pda - The PDA to query.
     * @param commitmentOrConfig - Optional. The commitment level or account info config.
     * @returns A promise that resolves to the account info or null if not found.
     */
    async queryPDAInfo(
        connection: Connection,
        pda: PublicKey,
        commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
    ): Promise<AccountInfo<Buffer> | null> {
        return connection.getAccountInfo(pda, commitmentOrConfig)
    }

    /**
     * Gets the ID PDA.
     *
     * @returns A tuple containing the derived PDA and the bump number.
     */
    idPDA(): [PublicKey, number] {
        return oappIDPDA(this.program)
    }

    /**
     * Gets the remote address for the given destination endpoint ID.
     *
     * @param connection - The Solana connection object.
     * @param dstEid - The destination endpoint ID.
     * @param commitmentOrConfig - Optional. The commitment level or account info config.
     * @returns A promise that resolves to the remote address or null if not found.
     */
    async getRemote(
        connection: Connection,
        dstEid: number,
        commitmentOrConfig?: web3.Commitment | web3.GetAccountInfoConfig
    ): Promise<Uint8Array | null> {
        const [remotePDA] = this.oappBaseDeriver.remote(dstEid)
        const info = await this.queryPDAInfo(connection, remotePDA, commitmentOrConfig)
        if (info) {
            // the first 8 bytes is account discriminator, so skip it. After that, the next 32 bytes is the address.
            const result = AddressType.read(info.data, 8)
            return Uint8Array.from(result)
        }
        return null
    }
}
