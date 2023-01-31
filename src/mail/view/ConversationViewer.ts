import m, { Children, Component, Vnode, VnodeDOM } from "mithril"
import { ConversationViewModel } from "./ConversationViewModel.js"
import { MailViewer } from "./MailViewer.js"
import { lang } from "../../misc/LanguageViewModel.js"
import { theme } from "../../gui/theme.js"
import { Button, ButtonType } from "../../gui/base/Button.js"
import { lastThrow, noOp } from "@tutao/tutanota-utils"
import { elementIdPart, getElementId, isSameId } from "../../api/common/utils/EntityUtils.js"
import { MiniMailViewer } from "./MiniMailViewer.js"
import { mailViewerMargin } from "./MailViewerUtils.js"
import { MailViewerViewModel } from "./MailViewerViewModel.js"
import { setMin } from "@tutao/tutanota-utils/dist/CollectionUtils.js"

export interface ConversationViewerAttrs {
	viewModel: ConversationViewModel
}

export class ConversationViewer implements Component<ConversationViewerAttrs> {
	private primaryDom: HTMLElement | null = null
	private containerDom: Element | null = null
	private didScroll: { mail: IdTuple } | null = null
	private orderedSubjects: string[] | null = null
	private visibleSubjects: Set<number> = new Set()

	view(vnode: Vnode<ConversationViewerAttrs>): Children {
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
		const entries = viewModel.entries()
		let lastSubject = null
		const subjects: string[] = []
		for (const entry of entries) {
			switch (entry.type) {
				case "mail": {
					const mailViewModel = entry.viewModel
					const normalizedSubject = this.normalizeSubject(mailViewModel.mail.subject)
					if (normalizedSubject !== lastSubject) {
						itemsWithHeaders.push(this.renderHeader(normalizedSubject, subjects.length))
						subjects.push(normalizedSubject)
						lastSubject = normalizedSubject
					}
					const isPrimary = mailViewModel === viewModel.primaryViewModel()

					itemsWithHeaders.push(this.renderViewer(mailViewModel, isPrimary, viewModel))
					break
				}
				case "deleted": {
					itemsWithHeaders.push(m(UnknownMailView, { key: getElementId(entry.entry) }))
					break
				}
			}
		}
		this.orderedSubjects = subjects
		itemsWithHeaders.push(m(".mt-l", { key: "footer" }))

		return m(".fill-absolute.nav-bg", [
			m(
				".fill-absolute.scroll",
				{
					oncreate: (vnode) => {
						console.log("create container")
						this.containerDom = vnode.dom
						// this.doScroll(viewModel)
					},
					onremove: () => {
						console.log("remove container")
					},
					// should probably use intersection observer to detect which subject is visible instead
					onscroll: (event: Event) => {
						// FIXME do not redraw all the time maybe
					},
				},
				itemsWithHeaders,
			),
			lastSubject && this.renderFloatingHeader(),
		])
	}

	private renderFloatingHeader() {
		const minVisibleSubject = setMin(this.visibleSubjects)
		if (this.orderedSubjects == null) return null
		if (minVisibleSubject === 0) return null
		let subjectToShow: string
		if (minVisibleSubject == null) {
			subjectToShow = lastThrow(this.orderedSubjects)
		} else {
			subjectToShow = this.orderedSubjects[minVisibleSubject - 1]
		}
		return m(
			".abs.nav-bg",
			{
				// class: mailViewerPadding(),
				class: mailViewerMargin(),
				style: {
					top: 0,
					left: 0,
					right: 0,
					borderBottom: `1px solid ${theme.list_border}`,
					transition: `200ms ease-in-out`,
					transform: this.containerDom && this.containerDom.scrollTop > 40 ? "translateY(0)" : "translateY(-40px)",
				},
			},
			m(
				".b.subject.text-break.pt-s.pb-s.text-ellipsis",
				{
					// class: mailViewerMargin(),
				},
				subjectToShow,
				// subject,
				// "Test subject but much longer so that maybe it wraps and like the whole message in there, which maniac actually does this? Unbelievable",
			),
		)
	}

	private renderViewer(mailViewModel: MailViewerViewModel, isPrimary: boolean, viewModel: ConversationViewModel) {
		return m(
			".border-radius-big.overflow-hidden.mt-m",
			{
				class: mailViewerMargin(),
				key: elementIdPart(mailViewModel.mail.conversationEntry),
				oncreate: (vnode: VnodeDOM) => {
					if (isPrimary) {
						console.log("create primary")
						this.primaryDom = vnode.dom as HTMLElement
						// this.doScroll(viewModel)
					}
				},
				onremove: () => {
					if (isPrimary) {
						console.log("remove primary")
					}
				},
				style: {
					border: `1px solid ${theme.list_border}`,
					backgroundColor: theme.content_bg,
				},
			},
			// probably should trigger the load from somewhere here but currently we need to render mail viewer for that to happen
			!isPrimary && mailViewModel.isCollapsed()
				? m(MiniMailViewer, {
						viewModel: mailViewModel,
				  })
				: m(MailViewer, {
						viewModel: mailViewModel,
						isPrimary: isPrimary,
				  }),
		)
	}

	private renderHeader(normalizedSubject: string, index: number): Children {
		return m(ObservableSubject, {
			subject: normalizedSubject,
			index,
			// FIXME
			cb: (index, visible) => (visible ? this.visibleSubjects.add(index) : this.visibleSubjects.delete(index)),
			key: "item-subject" + normalizedSubject,
		})
	}

	private doScroll(viewModel: ConversationViewModel) {
		const primaryDom = this.primaryDom
		const containerDom = this.containerDom
		if (!this.didScroll && primaryDom && containerDom && viewModel.isFinished()) {
			// we say that we *did* scroll even if it would be too early (primaryDom is not attached?)
			// but why is it not attached if it's already next frame?

			this.didScroll = { mail: viewModel.mail._id }

			let scrollAmount = 0
			const mailIndex = viewModel.getConversationIndexByMailId(viewModel.mail._id)
			if (mailIndex && mailIndex > 0) {
				// 66 is the height of the MiniMailViewer, with padding
				scrollAmount = 66 * (mailIndex - 1)
			}
			requestAnimationFrame(() => {
				// note: we do not have to worry about scrolling too far, scrollTo will handle that
				containerDom.scrollTo({ top: scrollAmount })
			})
		}
	}

	private normalizeSubject(subject: string): string {
		const match = subject.match(/^(?:(?:re|fwd):?\s*)*(.*)$/i)
		return match ? match[1] : ""
	}
}

interface ObservableSubjectAttrs {
	index: number
	cb: (index: number, visible: boolean) => unknown
	subject: string
}

class ObservableSubject implements Component<ObservableSubjectAttrs> {
	lastAttrs: ObservableSubjectAttrs

	observer = new IntersectionObserver((entries) => {
		const [entry] = entries
		this.lastAttrs.cb(this.lastAttrs.index, entry.isIntersecting)
	})

	constructor(vnode: Vnode<ObservableSubjectAttrs>) {
		this.lastAttrs = vnode.attrs
	}

	view(vnode: Vnode<ObservableSubjectAttrs>): Children {
		this.lastAttrs = vnode.attrs
		return m(
			".h5.subject.text-break.selectable.b.flex-grow.mt-m",
			{
				class: mailViewerMargin(),
				"aria-label": lang.get("subject_label") + ", " + (this.lastAttrs.subject || ""),
				style: { marginTop: "12px" },
				oncreate: (vnode) => {
					this.observer.observe(vnode.dom)
				},
				onremove: (vnode) => {
					this.observer.unobserve(vnode.dom)
					this.lastAttrs.cb(this.lastAttrs.index, false)
				},
			},
			this.lastAttrs.subject,
		)
	}
}

class UnknownMailView implements Component {
	view() {
		return m(
			".center.pt.pb.font-weight-600.border-radius-big.mt-m",
			{
				class: mailViewerMargin(),
				style: {
					border: `1px solid ${theme.list_border}`,
					color: theme.content_button,
				},
			},
			// FIXME: placeholder for now
			"Unknown email",
		)
	}
}
