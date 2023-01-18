import m, { Children, Component, Vnode } from "mithril"
import { getFolderIconByType, getMailAddressDisplayText } from "../model/MailUtils.js"
import { formatDateWithWeekday, formatTime } from "../../misc/Formatter.js"
import { MailViewerViewModel } from "./MailViewerViewModel.js"
import { theme } from "../../gui/theme.js"
import { MailFolderType } from "../../api/common/TutanotaConstants.js"
import { AllIcons, Icon } from "../../gui/base/Icon.js"
import { Icons } from "../../gui/base/icons/Icons.js"

export interface MiniMailViewerAttrs {
	viewModel: MailViewerViewModel
}

export class MiniMailViewer implements Component<MiniMailViewerAttrs> {
	view({ attrs }: Vnode<MiniMailViewerAttrs>): Children {
		const { viewModel } = attrs
		const { mail } = viewModel
		const dateTime = formatDateWithWeekday(mail.receivedDate) + " • " + formatTime(mail.receivedDate)
		return m(
			".flex.items-center.pt.pb.plr-l.click",
			{
				style: {
					color: theme.content_button,
				},
				// FIXME: is correct?
				click: () => viewModel.loadAll({notify: true}),
			},
			[
				m(".font-weight-600", getMailAddressDisplayText(mail.sender.name, mail.sender.address, true)),
				m(".flex-grow"),
				m(".flex.ml-between-s.items-center", [
					mail.attachments ? this.renderIcon(Icons.Attachment) : null,
					// FIXME the right folder
					viewModel.isConfidential() ? this.renderIcon(Icons.Lock) : null,
					this.renderIcon(getFolderIconByType(MailFolderType.INBOX)),
					m(".small.font-weight-600", dateTime),
				]),
			],
		)
	}

	private renderIcon(icon: AllIcons) {
		return m(Icon, {
			icon,
			container: "div",
			style: {
				fill: theme.content_button,
			},
		})
	}
}
