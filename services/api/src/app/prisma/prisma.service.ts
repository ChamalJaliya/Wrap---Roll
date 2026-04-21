import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/** Merges PrismaClient model delegates onto the injectable class (TS subclass inference fix). */
export interface PrismaService extends PrismaClient {}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is missing in PrismaService constructor');
    }
    
    try {
      console.log('--- INITIALIZING PRISMA with Adapter-PG (url len:', url.length, ') ---');
      const pool = new Pool({ 
        connectionString: url,
        max: 5, // Limiting pool for local dev
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      
      pool.on('error', (err) => {
        console.error('--- PRISMA POOL ERROR ---', err);
      });
      
      const adapter = new PrismaPg(pool);
      // Prisma 7: PrismaClient accepts driver adapter in constructor options
      super({ adapter });
      
      console.log('--- PRISMA SERVICE CONSTRUCTOR COMPLETING ---');
    } catch (e) {
      console.error('--- PRISMA CONSTR ERROR ---', e);
      throw e;
    }
  }

  async onModuleInit() {
    try {
      console.log('--- PRISMA ATTEMPTING CONNECT ---');
      await this.$connect();
      console.log('--- PRISMA CONNECTED SUCCESSFULLY ---');
    } catch (error) {
      console.error('--- PRISMA CONNECTION FAILED ---', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
