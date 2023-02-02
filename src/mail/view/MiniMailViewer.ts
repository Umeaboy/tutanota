import m, { Children, Component, Vnode } from "mithril"
import { getFolderIconByType, getFolderName, getMailAddressDisplayText } from "../model/MailUtils.js"
import { formatDateWithWeekday, formatTime } from "../../misc/Formatter.js"
import { MailViewerViewModel } from "./MailViewerViewModel.js"
import { theme } from "../../gui/theme.js"
import { AllIcons, Icon } from "../../gui/base/Icon.js"
import { Icons } from "../../gui/base/icons/Icons.js"
import { mailViewerPadding } from "./MailViewerUtils.js"
import { locator } from "../../api/main/MainLocator.js"
import { getMailFolderType } from "../../api/common/TutanotaConstants.js"

export interface MiniMailViewerAttrs {
	viewModel: MailViewerViewModel
}

export class MiniMailViewer implements Component<MiniMailViewerAttrs> {
	view({ attrs }: Vnode<MiniMailViewerAttrs>): Children {
		const { viewModel } = attrs
		const { mail } = viewModel
		const dateTime = formatDateWithWeekday(mail.receivedDate) + " • " + formatTime(mail.receivedDate)
		const folder = locator.mailModel.getMailFolder(mail._id[0])

		return m(
			".flex.items-center.pt.pb.click",
			{
				class: mailViewerPadding(),
				style: {
					color: theme.content_button,
				},
				// FIXME: is correct?
				onclick: () => viewModel.loadAll({ notify: true }),
			},
			[
				m(".font-weight-600", getMailAddressDisplayText(mail.sender.name, mail.sender.address, true)),
				m(".flex-grow"),
				m(".flex.ml-between-s.items-center", [
					mail.attachments.length > 0 ? this.renderIcon(Icons.Attachment) : null,
					viewModel.isConfidential() ? this.renderIcon(Icons.Lock) : null,
					folder ? this.renderIcon(getFolderIconByType(getMailFolderType(folder)), getFolderName(folder)) : null,
					m(".small.font-weight-600", dateTime),
				]),
			],
		)
	}

	private renderIcon(icon: AllIcons, hoverText: string | null = null) {
		return m(Icon, {
			icon,
			container: "div",
			style: {
				fill: theme.content_button,
			},
			hoverText: hoverText,
		})
	}
}
