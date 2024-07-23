const { RESOLVER, Lifetime } = require('awilix')
const { v4 } = require('uuid')

const TABLE_NAME = 'wallets'
const DEFAULT_RETURN_FIELDS = ['id', 'address', 'xpub', 'user_id', 'status']

const walletRepository = ({ database: knex, WalletAggregate }) => ({
  findByUser: async (userId, status = 'A') => {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return new Error('Invalid user ID provided. Please provide a valid string.');
    }

    try {
      const data = await knex.select(DEFAULT_RETURN_FIELDS)
        .from(TABLE_NAME)
        .where('user_id', knex.raw('?', [knex.fn.uuidBin(userId)])) 
        .where('status', status);

      return data.length && { ...data[0], id: knex.fn.binToUuid(d[0].id), user_id: knex.fn.binToUuid(d[0].user_id) };
    } catch (error) {
      console.error('Error fetching wallet by user:', error);
      throw new Error('Failed to fetch wallet by user');
    }
  },

// Explanation of Changes:

// Usage of Prepared Statements: I replaced the string  for the user_id in the where clause with a prepared statement using knex.raw('?', [value]). 
// this makses sure  that the user ID is treated as data and not part of the SQL query itself, preventing malicious code injection.
// Usage of Parameter Binding: The actual user ID value is bound as a separate parameter using [knex.fn.uuidBin(userId)] within the prepared statement.
// By using prepared statements and parameter binding, I prevent SQL injection attacks where an attacker could inject malicious code into the user ID and manipulate the database query. 

  findByAccount: (accountId, status = 'A') => {
    if (!accountId) {
      return []
    }
    return knex(TABLE_NAME).where({ acc_id: accountId, status }).select(DEFAULT_RETURN_FIELDS)
      .then(data => JSON.parse(JSON.stringify(data)))
      .then(data => {
        const d = data.map(r => ({ ...r, id: knex.fn.binToUuid(r.id), user_id: knex.fn.binToUuid(r.user_id) }))
        return d
      })
  },

  findByCustomer: (customerId, status = 'A') => {
    if (!customerId) {
      return []
    }
    return knex(TABLE_NAME).where({ customer_id: customerId, status }).select(DEFAULT_RETURN_FIELDS)
      .then(data => JSON.parse(JSON.stringify(data)))
      .then(data => {
        const d = data.map(r => ({ ...r, id: knex.fn.binToUuid(r.id), user_id: knex.fn.binToUuid(r.user_id) }))
        return d
      })
  },

  get: (id) => {
    return knex(TABLE_NAME).where('id', knex.fn.uuidToBin(id))
      .select(DEFAULT_RETURN_FIELDS)
      .then(d => d.length && { ...d[0], id: knex.fn.binToUuid(d[0].id), user_id: knex.fn.binToUuid(d[0].user_id) })
  },

  getByUser: async (userId) => {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return new Error('Invalid user ID provided. Please provide a valid string.');
    }

    try {
      const data = await knex(TABLE_NAME)
        .where('user_id', knex.fn.uuidToBin(userId))
        .select(DEFAULT_RETURN_FIELDS);

      return data.length && { ...data[0], id: knex.fn.binToUuid(d[0].id), user_id: knex.fn.binToUuid(d[0].user_id) };
    } catch (error) {
      console.error('Error fetching wallet by user:', error);
      throw new Error('Failed to fetch wallet by user');
    }
  },

  getByAddress: async (address) => {
    if (!address || typeof address !== 'string' || !address.trim()) {
      return new Error('Invalid address provided. Please provide a valid string.');
    }

    try {
          const data = await knex.select(DEFAULT_RETURN_FIELDS)
        .from(TABLE_NAME)
        .where('address', address);

      return data.length ? { ...data[0], id: knex.fn.binToUuid(d[0].id), user_id: knex.fn.binToUuid(d[0].user_id) } : null;

    } catch (error) {
      console.error('Error fetching wallet by address:', error);
      throw new Error('Failed to fetch wallet by address');
    }
  },

  add: (data) => {
    const walletId = v4()
    return knex(TABLE_NAME).insert({ id: knex.fn.uuidToBin(walletId), ...{ ...data, user_id: knex.fn.uuidToBin(data.user_id) } })
      .then(_ => WalletAggregate({
        id: walletId,
        ...data,
        userId: data.user_id
      }))
  },

  update: (id, data) => knex(TABLE_NAME).where('id', knex.fn.uuidToBin(id)).update(data)
    .then(_ => knex(TABLE_NAME).where('id', knex.fn.uuidToBin(id)).select(DEFAULT_RETURN_FIELDS))
    .then(d => ({ ...d[0], id: knex.fn.binToUuid(d[0].id), user_id: knex.fn.binToUuid(d[0].user_id) })),

  remove: (id) => knex(TABLE_NAME).where('id', knex.fn.uuidToBin(id)).del()
})

module.exports = walletRepository
walletRepository[RESOLVER] = {
  name: 'walletRepository',
  lifetime: Lifetime.SINGLETON
}



// UNIT TEST


const { walletRepository } = require('./walletRepository'); 
const knex = require('knex'); 
const WalletAggregate = jest.fn(); 

jest.mock('knex', () => ({
  __esModule: true, 
  default: jest.fn(() => ({
    insert: jest.fn(),
  })),
}));

describe('walletRepository.add', () => {
  beforeEach(() => {
    jest.clearAllMocks(); 
  });

  it('adds a wallet successfully', async () => {
    const data = { address: 'test@example.com', user_id: '123e4567-e89b-12d3-a456-426614174000' };
    const walletId = 'mock-wallet-id';

    knex.mockImplementation(() => ({
      insert: () => Promise.resolve([{ id: knex.fn.uuidToBin(walletId) }, ]),
    }));
    WalletAggregate.mockImplementationOnce(() => Promise.resolve({ id: walletId, ...data }));

    const response = await walletRepository.add(data);

    expect(knex.mock.instances[0].insert).toHaveBeenCalledWith(TABLE_NAME, {
      id: knex.fn.uuidToBin(walletId),
      ...data,
      user_id: knex.fn.uuidToBin(data.user_id),
    });
    expect(WalletAggregate).toHaveBeenCalledWith({ id: walletId, ...data, userId: data.user_id });
    expect(response).toEqual({ id: walletId, ...data });
  });

  it('throws error on insert failure', async () => {
    const data = { address: 'test@example.com', user_id: '123e4567-e89b-12d3-a456-426614174000' };

    knex.mockImplementation(() => ({
      insert: () => Promise.reject(new Error('Insert failed')),
    }));

    await expect(walletRepository.add(data)).rejects.toThrowError('Insert failed');
    expect(WalletAggregate).not.toHaveBeenCalled();
  });
});
