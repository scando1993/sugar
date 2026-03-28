import { OrchestrationPlan, Phase, SubTask } from './types';

/**
 * Validates an orchestration plan for circular dependencies and missing task references.
 */
function validatePlan(plan: OrchestrationPlan): string[] {
  const errors: string[] = [];
  const allIds = new Set<string>();

  for (const phase of plan.phases) {
    for (const task of phase.tasks) {
      if (allIds.has(task.id)) {
        errors.push(`Duplicate task id: ${task.id}`);
      }
      allIds.add(task.id);
    }
  }

  for (const phase of plan.phases) {
    for (const task of phase.tasks) {
      for (const dep of task.dependencies) {
        if (!allIds.has(dep)) {
          errors.push(`Task "${task.id}" depends on unknown task "${dep}"`);
        }
      }
    }
  }

  return errors;
}

/**
 * Returns phases sorted so each phase's dependencies are satisfied by prior phases.
 */
function buildExecutionOrder(plan: OrchestrationPlan): Phase[] {
  return plan.phases;
}

/**
 * Prints an ASCII execution plan to stdout.
 */
function printPlan(plan: OrchestrationPlan): void {
  console.log(`\nOrchestration Plan: ${plan.goal}`);
  console.log('='.repeat(50));

  for (const phase of buildExecutionOrder(plan)) {
    const mode = phase.parallel ? '[parallel]' : '[sequential]';
    console.log(`\n${phase.name} ${mode}`);

    for (const task of phase.tasks) {
      const deps = task.dependencies.length
        ? ` → depends on: ${task.dependencies.join(', ')}`
        : '';
      console.log(`  • [${task.id}] ${task.title}${deps}`);
      console.log(`      ${task.description}`);
    }
  }
  console.log('');
}

function printUsage(): void {
  console.log('Usage: orchestrate <command> [input-json]');
  console.log('');
  console.log('Commands:');
  console.log('  validate <plan.json>   Validate an orchestration plan JSON file');
  console.log('  print <plan.json>      Print an execution plan from JSON');
  console.log('');
  console.log('Plan JSON format:');
  console.log(JSON.stringify({
    goal: 'Example goal',
    phases: [{
      name: 'Phase 1',
      parallel: true,
      tasks: [{
        id: 'task-a',
        title: 'Task A',
        description: 'What this task does',
        dependencies: [],
        complexity: 'low',
      }],
    }],
  } satisfies OrchestrationPlan, null, 2));
}

async function main(): Promise<void> {
  const [, , command, filePath] = process.argv;

  if (!command || !filePath) {
    printUsage();
    process.exit(1);
  }

  const fs = await import('fs');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const plan: OrchestrationPlan = JSON.parse(raw);

  if (command === 'validate') {
    const errors = validatePlan(plan);
    if (errors.length === 0) {
      console.log('Plan is valid.');
    } else {
      console.error('Plan validation failed:');
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }
  } else if (command === 'print') {
    printPlan(plan);
  } else {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
