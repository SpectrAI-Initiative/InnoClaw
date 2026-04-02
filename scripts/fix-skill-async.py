#!/usr/bin/env python3
"""
Batch-fix SKILL.md files to replace manual __aenter__()/__aexit__() calls
with proper contextlib.AsyncExitStack usage.

Handles 3 patterns:
  A) Simple connect() function (130 files)
  B/D) Class-based connect/disconnect with streamablehttp_client (55 files)
  C) FastMCP Client-based connect/disconnect (2 files)
"""

import os
import re
import sys
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parent.parent / ".claude" / "skills"

stats = {"pattern_a": 0, "pattern_bd": 0, "pattern_c": 0, "skipped": 0, "errors": 0}


def fix_pattern_a(code: str) -> str:
    """Fix simple connect() function pattern.

    Before:
        async def connect(url, transport_type):
            transport = streamablehttp_client(url=url, headers={...})
            read, write, _ = await transport.__aenter__()
            ctx = ClientSession(read, write)
            session = await ctx.__aenter__()
            await session.initialize()
            return session, ctx, transport

    After:
        async def connect(url, stack):
            transport = streamablehttp_client(url=url, headers={...})
            read, write, _ = await stack.enter_async_context(transport)
            ctx = ClientSession(read, write)
            session = await stack.enter_async_context(ctx)
            await session.initialize()
            return session
    """
    # Add AsyncExitStack import
    if "AsyncExitStack" not in code:
        code = code.replace(
            "import asyncio\nimport json",
            "import asyncio\nimport json\nfrom contextlib import AsyncExitStack",
        )

    # Fix connect function signature
    code = re.sub(
        r"async def connect\(url,\s*transport_type\)",
        "async def connect(url, stack)",
        code,
    )

    # Fix __aenter__ calls inside connect
    code = code.replace(
        "await transport.__aenter__()",
        "await stack.enter_async_context(transport)",
    )
    code = code.replace(
        "await ctx.__aenter__()",
        "await stack.enter_async_context(ctx)",
    )

    # Fix return to not return ctx and transport
    code = code.replace("return session, ctx, transport", "return session")

    # Fix main() to use AsyncExitStack and update connect calls
    # Replace: sessions["name"], _, _ = await connect(url, "streamable-http")
    # With:    sessions["name"] = await connect(url, stack)
    code = re.sub(
        r'sessions\["([^"]+)"\],\s*_,\s*_\s*=\s*await connect\(([^,]+),\s*"[^"]+"\)',
        r'sessions["\1"] = await connect(\2, stack)',
        code,
    )

    # Wrap main() body in AsyncExitStack
    # Find "async def main():" and indent its body
    main_match = re.search(r"(async def main\(\):)\n", code)
    if main_match:
        main_start = main_match.end()
        # Find the body lines (everything indented after main)
        lines = code[main_start:].split("\n")
        body_lines = []
        for line in lines:
            if line and not line.startswith("    ") and not line.startswith("\t") and line.strip():
                break
            body_lines.append(line)

        # Remove trailing empty lines
        while body_lines and not body_lines[-1].strip():
            body_lines.pop()

        old_body = "\n".join(body_lines)
        # Add extra indentation and wrap in AsyncExitStack
        indented_body = "\n".join(
            ("    " + line if line.strip() else line) for line in body_lines
        )
        new_body = "    async with AsyncExitStack() as stack:\n" + indented_body

        code = code[:main_start] + new_body + code[main_start + len(old_body):]

    return code


def fix_pattern_bd(code: str) -> str:
    """Fix class-based connect/disconnect pattern with streamablehttp_client.

    Replaces __aenter__/__aexit__ in connect()/disconnect() with AsyncExitStack.
    """
    # Add AsyncExitStack import
    if "AsyncExitStack" not in code:
        if "import json" in code:
            code = code.replace(
                "import json",
                "import json\nfrom contextlib import AsyncExitStack",
            )
        elif "import asyncio" in code:
            code = code.replace(
                "import asyncio",
                "import asyncio\nfrom contextlib import AsyncExitStack",
            )

    # Fix connect method: add stack init and replace __aenter__
    # Pattern: self.read, self.write, self.get_session_id = await self.transport.__aenter__()
    code = code.replace(
        "self.read, self.write, self.get_session_id = await self.transport.__aenter__()",
        "self._stack = AsyncExitStack()\n            await self._stack.__aenter__()\n            self.read, self.write, self.get_session_id = await self._stack.enter_async_context(self.transport)",
    )
    # Pattern without get_session_id
    code = code.replace(
        "self.read, self.write, _ = await self.transport.__aenter__()",
        "self._stack = AsyncExitStack()\n            await self._stack.__aenter__()\n            self.read, self.write, _ = await self._stack.enter_async_context(self.transport)",
    )

    # Fix: self.session = await self.session_ctx.__aenter__()
    code = code.replace(
        "self.session = await self.session_ctx.__aenter__()",
        "self.session = await self._stack.enter_async_context(self.session_ctx)",
    )

    # Fix disconnect method: replace __aexit__ calls with stack.aclose()
    # Match the entire disconnect method and replace it
    disconnect_pattern = re.compile(
        r"(    async def disconnect\(self\):.*?)(?=\n    (?:def |async def |class |\S)|\n```|\Z)",
        re.DOTALL,
    )
    disconnect_replacement = '''    async def disconnect(self):
        """Disconnect from server"""
        try:
            if hasattr(self, '_stack'):
                await self._stack.aclose()
            print("✓ already disconnect")
        except Exception as e:
            print(f"✗ disconnect error: {e}")'''

    code = disconnect_pattern.sub(disconnect_replacement, code)

    return code


def fix_pattern_c(code: str) -> str:
    """Fix FastMCP Client-based pattern.

    Replaces await self.client.__aenter__() and __aexit__ with AsyncExitStack.
    """
    # Add AsyncExitStack import
    if "AsyncExitStack" not in code:
        if "import json" in code:
            code = code.replace(
                "import json",
                "import json\nfrom contextlib import AsyncExitStack",
            )

    # Fix: await self.client.__aenter__()
    code = code.replace(
        "self.client = Client(transport)\n            await self.client.__aenter__()",
        "self._stack = AsyncExitStack()\n            await self._stack.__aenter__()\n            self.client = Client(transport)\n            await self._stack.enter_async_context(self.client)",
    )

    # Fix disconnect
    disconnect_pattern = re.compile(
        r"(    async def disconnect\(self\):.*?)(?=\n    (?:def |async def |class |\S)|\n```|\Z)",
        re.DOTALL,
    )
    disconnect_replacement = '''    async def disconnect(self):
        """Disconnect from server"""
        try:
            if hasattr(self, '_stack'):
                await self._stack.aclose()
            print("✓ already disconnect")
        except Exception as e:
            print(f"✗ disconnect error: {e}")'''

    code = disconnect_pattern.sub(disconnect_replacement, code)

    return code


def detect_and_fix(content: str) -> tuple[str, str]:
    """Detect which pattern is used and apply the appropriate fix.
    Returns (fixed_content, pattern_name).
    """
    if "__aenter__" not in content:
        return content, "none"

    # Extract Python code blocks
    code_blocks = list(re.finditer(r"```python\n(.*?)```", content, re.DOTALL))
    if not code_blocks:
        return content, "none"

    fixed_content = content
    pattern_name = "none"

    for match in reversed(code_blocks):  # reverse to maintain offsets
        code = match.group(1)
        if "__aenter__" not in code:
            continue

        fixed_code = code
        if "class BiologyToolsClient" in code or "from fastmcp" in code:
            fixed_code = fix_pattern_c(code)
            pattern_name = "c"
        elif re.search(r"class \w+Client", code) or "class OrigeneClient" in code or re.search(r"class \w+:", code) and "self.transport" in code:
            fixed_code = fix_pattern_bd(code)
            pattern_name = "bd"
        elif "async def connect(url" in code:
            fixed_code = fix_pattern_a(code)
            pattern_name = "a"
        else:
            # Try generic __aenter__ replacement
            fixed_code = fix_pattern_bd(code)
            pattern_name = "bd"

        if fixed_code != code:
            start = match.start(1)
            end = match.end(1)
            fixed_content = fixed_content[:start] + fixed_code + fixed_content[end:]

    return fixed_content, pattern_name


def main():
    if not SKILLS_DIR.exists():
        print(f"Skills directory not found: {SKILLS_DIR}")
        sys.exit(1)

    skill_dirs = sorted(
        d for d in SKILLS_DIR.iterdir() if d.is_dir() and (d / "SKILL.md").exists()
    )

    print(f"Found {len(skill_dirs)} skill directories")
    print()

    for skill_dir in skill_dirs:
        skill_md = skill_dir / "SKILL.md"
        try:
            content = skill_md.read_text(encoding="utf-8")

            if "__aenter__" not in content:
                stats["skipped"] += 1
                continue

            fixed, pattern = detect_and_fix(content)

            if fixed != content:
                skill_md.write_text(fixed, encoding="utf-8")
                if pattern == "a":
                    stats["pattern_a"] += 1
                elif pattern == "bd":
                    stats["pattern_bd"] += 1
                elif pattern == "c":
                    stats["pattern_c"] += 1
                print(f"  Fixed [{pattern.upper():>2}] {skill_dir.name}")
            else:
                stats["skipped"] += 1

        except Exception as e:
            stats["errors"] += 1
            print(f"  ERROR {skill_dir.name}: {e}")

    print()
    print("=" * 50)
    print(f"Pattern A (simple connect):    {stats['pattern_a']}")
    print(f"Pattern B/D (class-based):     {stats['pattern_bd']}")
    print(f"Pattern C (FastMCP):           {stats['pattern_c']}")
    print(f"Skipped (no __aenter__):       {stats['skipped']}")
    print(f"Errors:                        {stats['errors']}")
    print(f"Total fixed:                   {stats['pattern_a'] + stats['pattern_bd'] + stats['pattern_c']}")


if __name__ == "__main__":
    main()
