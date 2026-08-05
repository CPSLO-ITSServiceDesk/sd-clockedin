"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const redisMock = {
    get: vitest_1.vi.fn(),
    set: vitest_1.vi.fn(),
    del: vitest_1.vi.fn(),
};
vitest_1.vi.mock('../lib/redis', () => ({
    redis: redisMock,
    isRedisEnabled: true,
}));
(0, vitest_1.describe)('withCache / invalidateCache', () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('returns cached value on hit without calling fn', async () => {
        const { withCache } = await Promise.resolve().then(() => __importStar(require('../lib/cache')));
        redisMock.get.mockResolvedValue({ shifts: [] });
        const fn = vitest_1.vi.fn().mockResolvedValue({ shifts: ['fresh'] });
        const result = await withCache('k', 15, fn);
        (0, vitest_1.expect)(result).toEqual({ shifts: [] });
        (0, vitest_1.expect)(fn).not.toHaveBeenCalled();
        (0, vitest_1.expect)(redisMock.set).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('computes, stores, and returns value on miss', async () => {
        const { withCache } = await Promise.resolve().then(() => __importStar(require('../lib/cache')));
        redisMock.get.mockResolvedValue(null);
        const fn = vitest_1.vi.fn().mockResolvedValue({ shifts: ['fresh'] });
        const result = await withCache('k', 15, fn);
        (0, vitest_1.expect)(result).toEqual({ shifts: ['fresh'] });
        (0, vitest_1.expect)(fn).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(redisMock.set).toHaveBeenCalledWith('k', { shifts: ['fresh'] }, { ex: 15 });
    });
    (0, vitest_1.it)('falls through to fn when Redis GET fails', async () => {
        const { withCache } = await Promise.resolve().then(() => __importStar(require('../lib/cache')));
        redisMock.get.mockRejectedValue(new Error('network'));
        const fn = vitest_1.vi.fn().mockResolvedValue('ok');
        await (0, vitest_1.expect)(withCache('k', 15, fn)).resolves.toBe('ok');
        (0, vitest_1.expect)(fn).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('deletes provided keys on invalidate', async () => {
        const { invalidateCache } = await Promise.resolve().then(() => __importStar(require('../lib/cache')));
        redisMock.del.mockResolvedValue(2);
        await invalidateCache('a', 'b');
        (0, vitest_1.expect)(redisMock.del).toHaveBeenCalledWith('a', 'b');
    });
});
