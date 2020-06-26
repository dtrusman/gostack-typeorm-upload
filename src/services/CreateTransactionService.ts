import { getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import TransactionRepository from '../repositories/TransactionsRepository';
import CategoryRepository from '../repositories/CategoryRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  categoryName: string;
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    categoryName,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionRepository);
    const categoryRepository = getCustomRepository(CategoryRepository);

    const transactions = await transactionRepository.find();
    const balance = await transactionRepository.getBalance(transactions);

    if (type === 'outcome' && balance.total - value < 0) {
      throw new AppError('Invalid transaction, insufficient funds', 400);
    }

    const category = await categoryRepository.findOne({
      where: { title: categoryName },
    });

    let transactionId: string;

    if (!category) {
      const newCategory = categoryRepository.create({ title: categoryName });
      const savedCategory = await categoryRepository.save(newCategory);
      transactionId = savedCategory.id;
    } else {
      const isTransactionExists = await transactionRepository.findOne({
        where: { title, category_id: category.id },
      });

      if (isTransactionExists) {
        throw new AppError('Transaction already exists', 409);
      }

      transactionId = category.id;
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category_id: transactionId,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
