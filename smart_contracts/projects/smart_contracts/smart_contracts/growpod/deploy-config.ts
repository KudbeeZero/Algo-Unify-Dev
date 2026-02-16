import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { GrowPodEmpireFactory } from '../artifacts/growpod/GrowPodEmpireClient'

export async function deploy() {
  console.log('=== Deploying GrowPod Empire ===')

  const algorand = AlgorandClient.fromEnvironment()
  const deployer = await algorand.account.fromEnvironment('DEPLOYER')

  const factory = algorand.client.getTypedAppFactory(GrowPodEmpireFactory, {
    defaultSender: deployer.addr,
  })

  const { appClient, result } = await factory.deploy({
    onUpdate: 'append',
    onSchemaBreak: 'append',
  })

  // Fund the app account for inner transactions (ASA creation + transfers)
  if (['create', 'replace'].includes(result.operationPerformed)) {
    await algorand.send.payment({
      amount: (1).algo(),
      sender: deployer.addr,
      receiver: appClient.appAddress,
    })
    console.log(`  Funded app account with 1 ALGO`)
  }

  console.log(`  App ID: ${appClient.appClient.appId}`)
  console.log(`  App Address: ${appClient.appAddress}`)
  console.log(`  Operation: ${result.operationPerformed}`)
}
