import {
  ListenFunctionObservable,
  ListenFunctionReturn,
  UploadFunctionSubscriber,
  ValidateFunctionSubscriber,
} from "@kyve/core/dist/faces";

import { GQLTagInterface } from "ardb/lib/faces/gql";

import hash from "object-hash";
import KYVE from "@kyve/core";
import { JWKInterface } from "arweave/node/lib/wallet";

import { Zilliqa } from "@zilliqa-js/zilliqa";

// import {TransactionObj, TxBlockObj} from "@zilliqa-js/core/src/types";

// overload default block
/*
export interface ZilliqaBlock extends TxBlockObj{
  transactions: TransactionObj[]
}
*/

export const upload = async (
  uploader: UploadFunctionSubscriber,
  pool: string,
  config: any
) => {
  const zilliqa = new Zilliqa(config.api);
  const subscriber = zilliqa.subscriptionBuilder.buildNewBlockSubscriptions(
    config.endpoint
  );

  subscriber.emitter.on("NewBlock", async (event: any) => {
    const hash = event.value.TxBlock.body.BlockHash;
    const BlockNum = event.value.TxBlock.header.BlockNum.toString();

    /*
    let block = (await zilliqa.blockchain.getTxBlock(BlockNum)).result as ZilliqaBlock;
    block.transactions = (await zilliqa.blockchain.getTxnBodiesForTxBlock(
      BlockNum
    )).result as TransactionObj[];
     */
    let block = (await zilliqa.blockchain.getTxBlock(BlockNum)).result as any;

    const transactions = await zilliqa.blockchain.getTxnBodiesForTxBlock(
      BlockNum
    );

    // use empty-array in case of no transactions
    block.transactions = transactions.result || ([] as any[]);

    const tags = [
      { name: "Block", value: hash },
      { name: "BlockNum", value: BlockNum.toString() },
    ];

    block.transactions.map((transaction: any) =>
      tags.push({ name: "Transaction", value: transaction.ID })
    );

    uploader.next({ data: block, tags });
  });

  subscriber.start();
};

export const validate = async (
  listener: ListenFunctionObservable,
  validator: ValidateFunctionSubscriber,
  pool: string,
  config: any
) => {
  const zilliqa = new Zilliqa(config.api);

  listener.subscribe(async (res: ListenFunctionReturn) => {
    const index = res.transaction.tags.findIndex(
      (tag: GQLTagInterface) =>
        tag.name === "Block" && tag.value === res.data.body.BlockHash
    );
    const BlockNum = parseInt(res.transaction.tags[index + 1].value);

    /*
    let block = (await zilliqa.blockchain.getTxBlock(BlockNum)).result as ZilliqaBlock;
    block.transactions = (await zilliqa.blockchain.getTxnBodiesForTxBlock(
      BlockNum
    )).result as TransactionObj[];
     */

    let block = (await zilliqa.blockchain.getTxBlock(BlockNum)).result as any;
    block.transactions = (
      await zilliqa.blockchain.getTxnBodiesForTxBlock(BlockNum)
    ).result as any[];

    const localHash = hash(block);
    const compareHash = hash(res.data);

    validator.next({ valid: localHash === compareHash, id: res.id });
  });
};

export default function main(pool: string, stake: number, jwk: JWKInterface) {
  const instance = new KYVE(
    {
      pool,
      stake,
      jwk,
    },
    upload,
    validate
  );

  return instance;
}
