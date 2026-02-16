import { createConfig } from '../../models/config.js';
import { validateResumateInitialized } from '../utils/validation.js';
import { MigrationService } from '../../services/migration-service.js';

export async function migrateCommand(options: {
  dryRun?: boolean;
  cleanup?: boolean;
  resume?: string;
  rollback?: string;
  yes?: boolean;
}): Promise<void> {
  const rootDir = process.cwd();
  const config = createConfig(rootDir);

  if (!(await validateResumateInitialized(rootDir))) {
    console.error('✗ Error: Not a Resumate project');
    console.error('');
    console.error("  Run 'resumate init' first to initialize the project.");
    process.exit(1);
  }

  const service = new MigrationService(config);

  try {
    // Handle rollback
    if (options.rollback) {
      console.log(`Rolling back migration: ${options.rollback}`);
      await service.rollbackMigration(options.rollback);
      console.log('✓ Migration rolled back successfully');
      return;
    }

    // Handle resume
    if (options.resume) {
      console.log(`Resuming migration: ${options.resume}`);
      const result = await service.resumeMigration(options.resume);
      printResult(result);
      return;
    }

    // Handle cleanup
    if (options.cleanup) {
      // Find most recent completed migration
      console.error('✗ Error: --cleanup requires a migration ID');
      console.error('');
      console.error("  Usage: resumate migrate --cleanup --resume <migration-id>");
      process.exit(1);
    }

    // Check for legacy structure
    if (!(await service.hasLegacyStructure())) {
      console.error('✗ Error: No old structure found to migrate');
      console.error('');
      console.error('  This project already uses the experience-based structure.');
      console.error('');
      console.error("  If you're starting a new project, no migration is needed.");
      process.exit(1);
    }

    // Dry run
    if (options.dryRun) {
      console.log('Migration Preview (--dry-run)');
      console.log('');
      const plan = await service.previewMigration();

      console.log(`Scanning old structure...`);
      console.log(`  Found ${plan.summary.filesTotal} files`);
      console.log('');
      console.log(`Grouping by experience...`);
      console.log(`  Identified ${plan.summary.experiencesTotal} unique experiences`);

      if (plan.conflicts.length > 0) {
        console.log(`  ${plan.conflicts.length} conflicts require resolution:`);
        plan.conflicts.forEach(c => {
          console.log(`    • ${c.message}`);
        });
      }

      if (plan.unmappedFiles.length > 0) {
        console.log(`  ${plan.unmappedFiles.length} files could not be mapped (no date prefix)`);
      }

      console.log('');
      console.log('Proposed structure:');
      console.log('  experiences/');
      for (const exp of plan.experiences) {
        console.log(`    └── ${exp.experienceDir}/`);
        if (exp.sourceFiles.draft) console.log(`        ├── draft.md`);
        if (exp.sourceFiles.refined) console.log(`        ├── refined.md`);
        if (exp.sourceFiles.archived) console.log(`        └── archived.md`);
      }

      console.log('');
      console.log("Run 'resumate migrate' (without --dry-run) to execute migration.");
      return;
    }

    // Execute migration
    console.log('Starting migration...');
    console.log('');

    const result = await service.migrate();
    printResult(result);

    if (result.success) {
      console.log('');
      console.log('  Next steps:');
      console.log('    • Review experiences/ directory to verify migration');
      console.log("    • Test commands: resumate refine, resumate archive");
      console.log(`    • Run 'resumate migrate --cleanup --resume ${result.migrationId}' to remove old directories`);
      console.log('    • Backup kept in .backup/ for recovery');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✗ Error: ${message}`);
    process.exit(1);
  }
}

function printResult(result: { success: boolean; migrationId: string; experiencesCreated: number; errors: Array<{ message: string }> }): void {
  if (result.success) {
    console.log('✓ Migration completed successfully!');
    console.log('');
    console.log(`  Created ${result.experiencesCreated} experiences in experiences/`);
    console.log(`  Migration ID: ${result.migrationId}`);
  } else {
    console.error('✗ Migration completed with errors');
    console.error('');
    console.error(`  Created ${result.experiencesCreated} experiences`);
    console.error(`  Errors: ${result.errors.length}`);
    result.errors.forEach(e => console.error(`    • ${e.message}`));
    console.error('');
    console.error(`  To retry: resumate migrate --resume ${result.migrationId}`);
    console.error(`  To rollback: resumate migrate --rollback ${result.migrationId}`);
  }
}
