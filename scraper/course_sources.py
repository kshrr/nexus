"""Reviewed course destinations; never accepts arbitrary administrator URLs."""
import json
import re
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

SOURCES = json.loads(Path(__file__).with_suffix('.json').read_text(encoding='utf-8'))


@dataclass(frozen=True)
class SourceDefinition:
    key: str
    name: str
    state: str
    levels: tuple[str, ...]
    session: str
    destinations: dict

    def canonical_url(self, raw, base=None):
        if not isinstance(raw, str) or len(raw) > 2000 or re.search(r'[\s\\\x00-\x1f\x7f]', raw):
            raise ValueError('Invalid course source URL')
        try:
            parts = urlsplit(urljoin(base or '', raw))
            rule = self.destinations.get(parts.hostname)
            if not rule or parts.scheme != 'https' or parts.username is not None or parts.password is not None or parts.port not in (None, 443):
                raise ValueError('Not a registered official course origin')
            path = parts.path or '/'
            if not re.fullmatch(rule['path'], path.rstrip('/') or '/', re.I):
                raise ValueError('Not a registered catalogue path')
            if parts.query:
                raise ValueError('Unsupported catalogue query')
            normal_path = path.rstrip('/') or '/'
            return urlunsplit(('https', parts.hostname, normal_path, '', ''))
        except (ValueError, TypeError) as error:
            raise ValueError('Not a registered official course URL') from error


def get_source(key):
    if key not in SOURCES:
        raise ValueError('Unknown university source')
    item = SOURCES[key]
    return SourceDefinition(key, item['name'], item['state'], tuple(item['levels']), item['session'], item['destinations'])


def get_adapter(key):
    get_source(key)
    if key == 'um':
        from .parsers.um import UMCourseAdapter
        return UMCourseAdapter()
    if key == 'unisza':
        from .parsers.unisza import UniSZACourseAdapter
        return UniSZACourseAdapter()
    if key == 'sunway_college':
        from .parsers.sunway_college import SunwayCollegeCourseAdapter
        return SunwayCollegeCourseAdapter()
    if key == 'umpsa':
        from .parsers.umpsa import UMPSACourseAdapter
        return UMPSACourseAdapter()
    if key == 'inti':
        from .parsers.inti import INTICourseAdapter
        return INTICourseAdapter()
    if key == 'taylors_college':
        from .parsers.taylors import TaylorsCollegeCourseAdapter
        return TaylorsCollegeCourseAdapter()
    if key == 'taylors':
        from .parsers.taylors import TaylorsCourseAdapter
        return TaylorsCourseAdapter()
    if key == 'utm':
        from .parsers.utm import UTMCourseAdapter
        return UTMCourseAdapter()
    if key == 'mmu':
        from .parsers.mmu import MMUCourseAdapter
        return MMUCourseAdapter()
    if key == 'utem':
        from .parsers.utem import UTeMCourseAdapter
        return UTeMCourseAdapter()
    raise ValueError('University adapter is not implemented yet')
