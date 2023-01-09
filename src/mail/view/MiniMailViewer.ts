import m, { Children, Component, Vnode } from "mithril"
import { Mail } from "../../api/entities/tutanota/TypeRefs.js"
import { getSenderHeading } from "../model/MailUtils.js"
import {IconButton} from "../../gui/base/IconButton.js"
import {Icons} from "../../gui/base/icons/Icons.js"
import {noOp} from "@tutao/tutanota-utils"
import {theme} from "../../gui/theme.js"
import {formatDateWithWeekday, formatTime} from "../../misc/Formatter.js"

export interface MiniMailViewerAttrs {
	mail: Mail
	primary: boolean
}

export class MiniMailViewer implements Component<MiniMailViewerAttrs> {
	view({ attrs }: Vnode<MiniMailViewerAttrs>): Children {
		const dateTime = formatDateWithWeekday(attrs.mail.receivedDate) + " • " + formatTime(attrs.mail.receivedDate)
		return m(".plr.mlr-l.mt.border-radius.flex.col", {
		style: {
			border: `1px solid ${attrs.primary ? theme.content_accent : theme.content_border}`,
			// FIXME: which color?
			// FIXME: unconditional for now
			backgroundColor: theme.navigation_bg,
		}
		}, [m(".flex", [m("", getSenderHeading(attrs.mail, false)), m(".flex-grow"), this.renderActions()]), m("", dateTime)])
	}

	private renderActions(): Children {
		const actions: Children = []
		actions.push(
			m(IconButton, {
				title: "reply_action",
				click: noOp,
				icon: Icons.Reply,
			}),
		)
		actions.push(
			m(IconButton, {
				title: "forward_action",
				icon: Icons.Forward,
				click: noOp,
			})
		)
		actions.push(
			m(IconButton, {
				title: "more_label",
				icon: Icons.More,
				click: noOp,
			})
		)
		return actions
	}
}
