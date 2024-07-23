if (process.env.NODE_ENV === 'production') {
  require('dotenv').config()
} else {
  require('dotenv-flow').config()
}

const Moralis = require('moralis').default
const { EvmChain } = require('@moralisweb3/common-evm-utils')
const { asValue } = require('awilix')
const cron = require('node-cron')

const { APP_URL, BLOCKCHAIN_NETWORK_TYPE, MORALIS_KEY, PORT } = process.env

const container = require('./infrastructure/config/container')()
const app = require('./infrastructure/webserver/server')(container.cradle)

app.listen(PORT, () => {
  console.log('Quiver API is up and running :-D')
  Moralis.start({
    apiKey: MORALIS_KEY
  })
    .then(_ => {
      const streamConfig = {
        chains: (BLOCKCHAIN_NETWORK_TYPE === 'testnet' ? [EvmChain.MUMBAI] : [EvmChain.POLYGON]),
        description: 'Monitor user wallets',
        tag: 'quiver-wallet-monitor',
        webhookUrl: `${APP_URL}/webhooks/wallets/monitorings`,
        includeNativeTxs: true,
        includeContractLogs: true
      }

      return Moralis.Streams.add(streamConfig)
    })
    .then(stream => {
      const { id } = stream.toJSON()

      container.register({ moralisStreamId: asValue(id) })

      cron.schedule('*/30 * * * *', () => {
        container.cradle.doCronJobGetMarketDataSnapshot()
      })

      cron.schedule('0 */10 * * *', () => {
        container.cradle.doCronJobGetFiatExchangeRates()
      })

      cron.schedule('30 2 * * *', () => {
        container.cradle.doCronJobGetSupportedBanksForRamp()
      })

      container.cradle.WalletService.setupRampWebhook()
    })
})
