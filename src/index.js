import Gdax from 'gdax'
import sortBy from 'lodash/sortBy'
import sum from 'lodash/sum'
import uniq from 'lodash/uniq'
import {table} from 'table'
import creds from './creds.json'
import fixedFills from './fixed_fills.json'
import {coloredEuroString, euroString} from './utils'
import chalk from 'chalk'

const authedClient = new Gdax.AuthenticatedClient(
  creds.KEY,
  creds.B64_SECRET,
  creds.PASSPHRASE,
  creds.API_URI
)

const publicClient = new Gdax.PublicClient()

function tableDataForProduct(productId, ticker, fills) {
  const data = fills.map(fill => {
    return [
      fill.created_at,
      fill.product_id,
      fill.size,
      euroString(fill.price),
      euroString(fill.fee),
      euroString(fill.cost),
      euroString(fill.value),
      coloredEuroString(fill.gain),
      (100 * fill.gain / fill.cost).toFixed(2)
    ]
  })

  const sumGains = sum(fills.map(fill => Number(fill.gain)))
  const sumCost = sum(fills.map(fill => Number(fill.cost)))

  return [
    ...data,
    [
      chalk.blue('--------------------'),
      chalk.blue(productId),
      sum(fills.map(fill => Number(fill.size))).toFixed(8),
      euroString(ticker.price),
      euroString(sum(fills.map(fill => Number(fill.fee)))),
      euroString(sumCost),
      euroString(sum(fills.map(fill => Number(fill.value)))),
      coloredEuroString(sumGains),
      (100 * sumGains / sumCost).toFixed(2)
    ]
  ]
}

async function main() {
  try {
    // Get all fills
    const fills = (await authedClient.getFills()).concat(fixedFills)

    // Collect all product ids from fills
    const productIds = uniq(fills.map(f => f.product_id))

    // Get current value of each product
    const currentValue = {}
    for (let productId of productIds) {
      const ticker = await publicClient.getProductTicker(productId)
      currentValue[productId] = ticker
    }

    // Augment fills with computed info
    const sortedFills = sortBy(
      fills.map(fill => {
        const cost = Number(fill.size) * Number(fill.price) + Number(fill.fee)
        const value =
          Number(fill.size) * Number(currentValue[fill.product_id].price)

        return {
          ...fill,
          cost,
          value,
          gain: value - cost
        }
      }),
      ['created_at']
    )

    const columns = [
      'Created at',
      'Product',
      'Size',
      'Price',
      'Fee',
      'Cost',
      'Current price',
      'Gain',
      '%'
    ]

    const lineIndexes = [0, 1]

    const config = {
      columns: {
        2: {alignment: 'right'},
        3: {alignment: 'right'},
        4: {alignment: 'right'},
        5: {alignment: 'right'},
        6: {alignment: 'right'},
        7: {alignment: 'right'},
        8: {alignment: 'right'}
      },
      drawHorizontalLine: index => lineIndexes.includes(index)
    }

    const data = productIds.reduce((acc, productId) => {
      const productFills = sortedFills.filter(
        fill => fill.product_id === productId
      )

      lineIndexes.push(
        lineIndexes[lineIndexes.length - 1] + productFills.length + 1
      )

      return [
        ...acc,
        ...tableDataForProduct(productId, currentValue[productId], productFills)
      ]
    }, [])

    const output = table([columns, ...data], config)
    console.log(output)

    const totalInvested = sortedFills.reduce((acc, fill) => acc + fill.cost, 0)
    const totalValue = sortedFills.reduce((acc, fill) => acc + fill.value, 0)
    const totalGain = sortedFills.reduce((acc, fill) => acc + fill.gain, 0)
    const totalGrowth = (100 * totalGain / totalInvested).toFixed(2)

    console.log('Total invested: ', euroString(totalInvested))
    console.log('Total value: ', euroString(totalValue))
    console.log('Total gain: ', coloredEuroString(totalGain))
    console.log('Total growth: ', totalGrowth, '%')
  } catch (error) {
    console.log('error', error)
  }
}

main()
