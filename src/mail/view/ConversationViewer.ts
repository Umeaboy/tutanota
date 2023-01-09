import m, { Children, Component, Vnode, VnodeDOM } from "mithril"
import { ConversationViewModel } from "./ConversationViewModel.js"
import { MailViewer } from "./MailViewer.js"
import { lang } from "../../misc/LanguageViewModel.js"
import { theme } from "../../gui/theme.js"
import { Button, ButtonType } from "../../gui/base/Button.js"
import { noOp } from "@tutao/tutanota-utils"
import {getElementId, isSameId} from "../../api/common/utils/EntityUtils.js"

export interface ConversationViewerAttrs {
	viewModel: ConversationViewModel
}

export class ConversationViewer implements Component<ConversationViewerAttrs> {
	private primaryDom: HTMLElement | null = null
	private containerDom: Element | null = null
	private didScroll: { mail: IdTuple } | null = null

	view(vnode: Vnode<ConversationViewerAttrs>): Children {
		let lastSubject = null
		const itemsWithHeaders: Children[] = []
		const viewModel = vnode.attrs.viewModel
		if (this.didScroll && !isSameId(viewModel.mail._id, this.didScroll.mail)) {
			this.didScroll = null
		}
		this.doScroll(viewModel)

		if (viewModel.isConnectionLost()) {
			return m(
				".center",
				m(Button, {
					type: ButtonType.Secondary,
					label: "retry_action",
					// fixme
					click: () => noOp(),
				}),
			)
		}
		const viewModels = viewModel.viewModels()
		for (const mailViewModel of viewModels) {
			const normalizedSubject = this.normalizeSubject(mailViewModel.mail.subject)
			if (normalizedSubject !== lastSubject) {
				itemsWithHeaders.push(
					m(
						".h5.subject.text-break.selectable.b.flex-grow.pl-l.pr",
						{
							key: normalizedSubject,
							"aria-label": lang.get("subject_label") + ", " + (normalizedSubject || ""),
							style: { marginTop: "12px" },
						},
						normalizedSubject,
					),
				)
				lastSubject = normalizedSubject
			}
			const isPrimary = mailViewModel === viewModel.primaryViewModel()

			itemsWithHeaders.push(
				m(
					".plr.pb.mlr-l.mt.border-radius",
					{
						key: getElementId(mailViewModel.mail),
						oncreate: (vnode: VnodeDOM) => {
							if (isPrimary) {
								console.log("create primary")
								this.primaryDom = vnode.dom as HTMLElement
								this.doScroll(viewModel)
							}
						},
						onremove: () => {
							if (isPrimary) {
								console.log("remove primary")
							}
						},
						style: {
							border: `2px solid ${isPrimary ? theme.content_accent : theme.content_border}`,
							backgroundColor:
								mailViewModel.getSanitizedMailBody() == null && !mailViewModel.isLoading() && !mailViewModel.isConnectionLost()
									? theme.navigation_bg
									: undefined,
						},
					},
					m(MailViewer, {
						viewModel: mailViewModel,
						isPrimary: isPrimary,
					}),
				),
			)
		}
		itemsWithHeaders.push(m(".mt-l", { key: "footer" }))

		return m(
			".fill-absolute.scroll",
			{
				oncreate: (vnode) => {
					console.log("create container")
					this.containerDom = vnode.dom
					this.doScroll(viewModel)
				},
				onremove: () => {
					console.log("remove container")
				}
			},
			itemsWithHeaders,
		)
	}

	private doScroll(viewModel: ConversationViewModel) {
		const primaryDom = this.primaryDom
		const containerDom = this.containerDom
		if (!this.didScroll && primaryDom && containerDom && viewModel.isFinished()) {
			// we say that we *did* scroll even if it would be too early (primaryDom is not attached?)
			// but why is it not attached if it's already next frame?

			this.didScroll = {mail: viewModel.mail._id}
			const stack = new Error().stack
			requestAnimationFrame(() => {
				console.log("scrolling to", primaryDom.offsetTop, primaryDom.parentNode, stack)
				containerDom.scrollTo({ top: primaryDom.offsetTop })
			})
		}
	}

	private normalizeSubject(subject: string): string {
		const match = subject.match(/^(?:(?:re|fwd):?\s*)*(.*)$/i)
		return match ? match[1] : ""
	}
}
