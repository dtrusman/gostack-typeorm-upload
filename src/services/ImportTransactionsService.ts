import { getCustomRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import CategoryRepository from '../repositories/CategoryRepository';
import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}
class ImportTransactionsService {
  async execute(csvFile: string): Promise<Transaction[]> {
    const categoryRepository = getCustomRepository(CategoryRepository);
    const transactionRepository = getCustomRepository(TransactionRepository);

    const csvFilePath = path.resolve(__dirname, '..', '..', 'tmp', csvFile);

    const readCSVStream = fs.createReadStream(csvFilePath);

    const parseStream = csvParse({
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCSV = readCSVStream.pipe(parseStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;

      transactions.push({ title, type, value, category });

      categories.push(category);
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    const existingCategoriesDB = await categoryRepository.find({
      where: { title: In(categories) },
    });

    const categoriesTitlesExisting = existingCategoriesDB.map(
      (category: Category) => category.title,
    );

    const categoriesToAdd = categories
      .filter(category => !categoriesTitlesExisting.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoryRepository.create(
      categoriesToAdd.map(title => ({ title })),
    );

    await categoryRepository.save(newCategories);

    const allCategories = [...existingCategoriesDB, ...newCategories];

    const createTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.title,
        ),
      })),
    );

    await transactionRepository.save(createTransactions);

    await fs.promises.unlink(csvFilePath);

    return createTransactions;
  }
}

export default ImportTransactionsService;
