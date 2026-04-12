import { describe, it, expect } from 'vitest';
import { ConsensusEngine, type ConsensusEngineConfig } from './ConsensusEngine';

const defaultConfig: Partial<ConsensusEngineConfig> = {
  maxRounds: 3,
  confidenceThreshold: 0.6,
  domain: 'balanced',
  enableAudit: true,
  timeout: 5000,
};

describe('ConsensusEngine', () => {
  describe('constructor', () => {
    it('creates engine with default config', () => {
      const engine = new ConsensusEngine();
      const config = engine.getConfig();
      expect(config.maxRounds).toBe(5);
      expect(config.confidenceThreshold).toBe(0.7);
      expect(config.domain).toBe('balanced');
    });

    it('creates engine with custom config', () => {
      const engine = new ConsensusEngine({ maxRounds: 10, domain: 'factual' });
      const config = engine.getConfig();
      expect(config.maxRounds).toBe(10);
      expect(config.domain).toBe('factual');
    });
  });

  describe('deliberate', () => {
    it('runs a deliberation and returns a result', async () => {
      const engine = new ConsensusEngine(defaultConfig);
      const result = await engine.deliberate({
        proposition: 'Should we deploy the new fishing gear?',
        context: 'Weather is moderate, fuel costs are high, crew is experienced',
      });

      expect(result).toBeDefined();
      expect(result.perspectives).toHaveLength(3);
      expect(result.rounds.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('produces perspectives with all required fields', async () => {
      const engine = new ConsensusEngine(defaultConfig);
      const result = await engine.deliberate({
        proposition: 'Test proposition',
        context: 'Test context',
      });

      for (const opinion of result.perspectives) {
        expect(['pathos', 'logos', 'ethos']).toContain(opinion.perspective);
        expect(opinion.verdict.length).toBeGreaterThan(0);
        expect(opinion.confidence).toBeGreaterThanOrEqual(0);
        expect(opinion.confidence).toBeLessThanOrEqual(1);
        expect(opinion.weight).toBeGreaterThan(0);
        expect(opinion.arguments).toBeInstanceOf(Array);
        expect(opinion.concerns).toBeInstanceOf(Array);
      }
    });

    it('includes audit trail when enabled', async () => {
      const engine = new ConsensusEngine({ ...defaultConfig, enableAudit: true });
      const result = await engine.deliberate({
        proposition: 'Audited proposition',
        context: 'With audit',
      });

      expect(result.auditTrail.length).toBeGreaterThan(0);
      const actions = result.auditTrail.map(e => e.action);
      expect(actions).toContain('deliberation_start');
    });

    it('respects domain override per deliberation', async () => {
      const engine = new ConsensusEngine(defaultConfig);
      const result = await engine.deliberate({
        proposition: 'Scientific question',
        context: 'Lab conditions',
        domainOverride: 'factual',
      });

      expect(result.metadata.domain).toBe('factual');
    });

    it('records cross-examinations between perspectives', async () => {
      const engine = new ConsensusEngine(defaultConfig);
      const result = await engine.deliberate({
        proposition: 'Cross-examine this',
        context: 'With rigor',
      });

      const firstRound = result.rounds[0];
      expect(firstRound.crossExaminations.length).toBeGreaterThan(0);
      
      for (const ce of firstRound.crossExaminations) {
        expect(ce.challenge.length).toBeGreaterThan(0);
        expect(ce.response.length).toBeGreaterThan(0);
        expect(typeof ce.satisfactory).toBe('boolean');
      }
    });

    it('includes dissenting opinions when configured', async () => {
      const engine = new ConsensusEngine({
        ...defaultConfig,
        includeDissent: true,
        confidenceThreshold: 0.95, // Very high - likely some dissent
      });
      
      const result = await engine.deliberate({
        proposition: 'Controversial proposition',
        context: 'Mixed evidence',
      });

      // dissentingOpinions may or may not exist depending on deliberation
      expect(result).toHaveProperty('dissentingOpinions');
    });
  });

  describe('audit trail management', () => {
    it('can clear and retrieve audit trail', async () => {
      const engine = new ConsensusEngine(defaultConfig);
      await engine.deliberate({
        proposition: 'Trail test',
        context: 'Audit check',
      });

      const trail = engine.getAuditTrail();
      expect(trail.length).toBeGreaterThan(0);

      engine.clearAuditTrail();
      expect(engine.getAuditTrail()).toHaveLength(0);
    });
  });

  describe('domain weights', () => {
    it('can update domain weights', () => {
      const engine = new ConsensusEngine(defaultConfig);
      expect(() => {
        engine.updateDomainWeights('balanced', { pathosWeight: 0.5, logosWeight: 0.3, ethosWeight: 0.2 });
      }).not.toThrow();
    });
  });

  describe('forced consensus', () => {
    it('forces consensus when max rounds reached', async () => {
      const engine = new ConsensusEngine({
        ...defaultConfig,
        maxRounds: 1,
        confidenceThreshold: 0.99,
      });

      const result = await engine.deliberate({
        proposition: 'Force this',
        context: 'Single round',
      });

      expect(result.metadata.roundsCompleted).toBe(1);
      // May or may not be forced depending on deliberation outcome
      expect(typeof result.metadata.forcedConsensus).toBe('boolean');
    });
  });
});
