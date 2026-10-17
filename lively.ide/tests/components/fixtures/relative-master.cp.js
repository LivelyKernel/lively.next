import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color } from 'lively.graphics';
import { Base } from './relative-master-base.cp.js';

const LocalBase = component({ name: 'local master base', fill: Color.green });
component.DescriptorClass = InteractiveComponentDescriptor;
const RelativeMaster = component({ name: 'relative master', fill: Color.red });
component.DescriptorClass = ComponentDescriptor;

export { Base, LocalBase, RelativeMaster };
