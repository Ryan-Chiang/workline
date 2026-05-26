import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { renderWeeklySkillMarkdown } from './weekly-skill-template.ts';

export type SkillTarget = 'codex' | 'claude' | 'both';

export type InstalledSkill = {
  target: Exclude<SkillTarget, 'both'>;
  path: string;
};

function userHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? os.homedir();
}

function codexHome(): string {
  return process.env.CODEX_HOME ?? path.join(userHome(), '.codex');
}

// 写入前先解析所有目标目录，让安装行为可预测，也方便测试断言。
function targetSkillPaths(target: SkillTarget): InstalledSkill[] {
  const targets: Array<Exclude<SkillTarget, 'both'>> = target === 'both' ? ['codex', 'claude'] : [target];
  return targets.map((item) => ({
    target: item,
    path: item === 'codex'
      ? path.join(codexHome(), 'skills', 'weekly')
      : path.join(userHome(), '.claude', 'skills', 'weekly'),
  }));
}

// 默认安装到两端，保证同时使用 Codex 和 Claude 的用户得到一致的本地事实工作流。
export function parseSkillTarget(value: string | undefined): SkillTarget {
  if (!value || value === 'both') {
    return 'both';
  }
  if (value === 'codex' || value === 'claude') {
    return value;
  }
  throw new Error(`Invalid --target: ${value}`);
}

// 安装本质上只是写文件；skill 执行时再回调 CLI，因此这里保持低维护成本。
export async function installWeeklySkill(target: SkillTarget): Promise<InstalledSkill[]> {
  const installed = targetSkillPaths(target);
  const skillMarkdown = renderWeeklySkillMarkdown();
  for (const item of installed) {
    await fs.mkdir(item.path, { recursive: true });
    await fs.writeFile(path.join(item.path, 'SKILL.md'), skillMarkdown, 'utf8');
  }
  return installed;
}
